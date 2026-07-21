import express from 'express';
import dotenv from 'dotenv';
import { db } from '../server-db.js';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

// Lazy initialize Gemini client to avoid crashes if GEMINI_API_KEY is not defined initially
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

const app = express();
app.use(express.json());

// Database Initialization (safe to call on every cold start; HybridDB.init() is a no-op when Supabase is enabled)
let dbInitPromise: Promise<void> | null = null;
app.use(async (_req, _res, next) => {
  if (!dbInitPromise) dbInitPromise = db.init();
  await dbInitPromise;
  next();
});

// Authentication Middleware
const authMiddleware = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sesi tidak valid, silakan login kembali.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const userId = await db.validateSession(token);
    if (!userId) {
      return res.status(401).json({ error: 'Sesi kedaluwarsa atau tidak valid.' });
    }
    req.userId = userId;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Kesalahan otentikasi' });
  }
};

// ---------------------------------------------------------------------
// AI ADVISOR CONFIG
// ---------------------------------------------------------------------

// Aturan eksplisit soal BAGAIMANA AI boleh memberi saran finansial.
// Tanpa batasan ini, model bisa kasih saran generik atau (lebih buruk)
// menyarankan hal berisiko seperti pinjol.
const SYSTEM_INSTRUCTION = `Anda adalah BufferFin Advisor, konsultan keuangan pribadi untuk masyarakat Indonesia kelas menengah.

ATURAN MEMBERI SARAN:
1. Jangan pernah menghakimi kebiasaan finansial pengguna. Gunakan nada suportif, bukan menggurui.
2. Saran harus SPESIFIK dan BISA DIEKSEKUSI dalam 1-7 hari ke depan. Hindari saran umum seperti "kurangi jajan" tanpa angka atau konteks konkret dari data yang diberikan.
3. Jika data transaksi masih sedikit (kurang dari seminggu), akui keterbatasan ini secara eksplisit dan jangan buat proyeksi yang terdengar terlalu pasti.
4. JANGAN PERNAH menyarankan tindakan finansial berisiko: pinjaman online (pinjol), skema investasi cepat kaya, judi, atau "gali lubang tutup lubang" (utang baru untuk menutup utang lama).
5. Jika kondisi menunjukkan potensi masalah serius (defisit besar berulang, pola pengeluaran tidak sehat), sarankan dengan hormat agar pengguna mempertimbangkan konsultasi dengan penasihat keuangan berlisensi atau lembaga resmi seperti OJK. Jangan berpura-pura menjadi pengganti nasihat profesional untuk kasus berat.
6. Fokus saran pada kategori pengeluaran terbesar pengguna secara spesifik, bukan saran finansial umum yang tidak terkait datanya.
7. Selalu jawab dalam Bahasa Indonesia yang ramah dan mudah dipahami, hindari jargon finansial yang rumit.`;

// Skema output terstruktur — menggantikan markdown bebas supaya frontend
// bisa render tiap bagian secara konsisten (summary card, tips list, quote).
const ANALYSIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: 'Analisis singkat 2-3 kalimat, empatik dan realistis tentang kondisi keuangan pengguna saat ini.',
    },
    confidenceNote: {
      type: Type.STRING,
      description: 'Catatan singkat (1 kalimat) jika data transaksi masih terbatas/sedikit. String kosong jika data sudah cukup untuk proyeksi yang wajar.',
    },
    tips: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Maksimal 3 saran konkret, spesifik, dan actionable — fokus pada kategori pengeluaran paling boros pengguna.',
    },
    motivationalQuote: {
      type: Type.STRING,
      description: 'Satu kalimat kutipan motivasi finansial singkat dalam Bahasa Indonesia.',
    },
  },
  required: ['summary', 'tips', 'motivationalQuote'],
};

interface AiAdvice {
  summary: string;
  confidenceNote: string;
  tips: string[];
  motivationalQuote: string;
}

// Fallback rule-based generator, dipakai kalau Gemini API gagal/timeout/key belum di-set.
// Bentuknya sengaja disamakan strukturnya dengan AiAdvice supaya frontend tidak perlu
// tahu apakah saran ini berasal dari AI atau fallback.
function generateFallbackAdvice(params: {
  healthScore: 'Aman' | 'Peringatan' | 'Bahaya';
  isDeficit: boolean;
  currentBalance: number;
  totalNonRoutineExpense: number;
  dailyAverageRoutine: number;
  projectedExpense: number;
  daysUntilPayday: number;
  deficitOrSurplusAmount: number;
  topCategory: string;
  topCategoryAmount: number;
  daysWithRoutine: number;
}): AiAdvice {
  const {
    healthScore, isDeficit, currentBalance, totalNonRoutineExpense,
    dailyAverageRoutine, projectedExpense, daysUntilPayday,
    deficitOrSurplusAmount, topCategory, topCategoryAmount, daysWithRoutine,
  } = params;

  const idr = (n: number) => Math.round(n).toLocaleString('id-ID');

  const summary = isDeficit
    ? `Kondisi keuangan Anda saat ini masuk kategori ${healthScore}. Berdasarkan rata-rata pengeluaran rutin harian sebesar Rp${idr(dailyAverageRoutine)}, Anda diproyeksikan mengalami defisit sekitar Rp${idr(deficitOrSurplusAmount)} sebelum hari gajian tiba dalam ${daysUntilPayday} hari.`
    : `Kondisi keuangan Anda saat ini masuk kategori ${healthScore}. Saldo Anda diperkirakan cukup untuk menutupi kebutuhan rutin hingga gajian, dengan potensi surplus sekitar Rp${idr(deficitOrSurplusAmount)}.`;

  const confidenceNote = daysWithRoutine <= 2
    ? 'Data transaksi Anda masih sangat sedikit, jadi proyeksi ini masih kasar dan akan makin akurat seiring Anda rutin mencatat.'
    : daysWithRoutine <= 7
    ? 'Data transaksi Anda masih di bawah seminggu, proyeksi ini indikatif dan bisa berubah.'
    : '';

  const tips = [
    `Kategori "${topCategory}" adalah pengeluaran terbesar Anda (Rp${idr(topCategoryAmount)}). Coba tetapkan batas mingguan untuk kategori ini dan pantau langsung di aplikasi.`,
    `Prioritaskan sisa saldo Rp${idr(currentBalance)} untuk kebutuhan rutin (makanan, transportasi, kesehatan) terlebih dahulu sebelum pengeluaran non-esensial.`,
    totalNonRoutineExpense > 0
      ? `Anda tercatat memiliki pengeluaran non-rutin sebesar Rp${idr(totalNonRoutineExpense)} (tagihan/hiburan). Pertimbangkan menunda pengeluaran non-rutin baru sampai setelah gajian.`
      : `Pastikan tanggal gajian Anda sudah diatur dengan akurat agar proyeksi pengeluaran lebih presisi.`,
  ];

  const motivationalQuote = 'Menghemat satu rupiah hari ini berarti mengamankan kebebasan finansial Anda di masa depan.';

  return { summary, confidenceNote, tips, motivationalQuote };
}

// Validasi minimal supaya kita tidak meneruskan output AI yang cacat ke user.
function isValidAdvice(data: any): data is AiAdvice {
  return (
    data &&
    typeof data.summary === 'string' && data.summary.trim().length > 0 &&
    Array.isArray(data.tips) && data.tips.length > 0 &&
    typeof data.motivationalQuote === 'string'
  );
}

// --- API ROUTES ---
// (identik dengan server.ts, dipindah ke sini supaya bisa jalan sebagai Vercel Function)

app.post('/api/auth/register', async (req: express.Request, res: express.Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password harus diisi' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  }
  try {
    const user = await db.registerUser(email, password);
    const token = await db.createSession(user.id);
    res.status(201).json({ user, token });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registrasi gagal' });
  }
});

app.post('/api/auth/login', async (req: express.Request, res: express.Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password harus diisi' });
  }
  try {
    const user = await db.loginUser(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }
    const token = await db.createSession(user.id);
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: 'Login gagal' });
  }
});

app.put('/api/user/profile', authMiddleware, async (req: any, res: express.Response) => {
  try {
    const { username, email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email harus diisi' });
    }
    const user = await db.updateUserProfile(req.userId, username || '', email);
    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    res.json({ user });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal memperbarui profil' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req: any, res: express.Response) => {
  try {
    const user = await db.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memverifikasi user' });
  }
});

app.put('/api/user/payday', authMiddleware, async (req: any, res: express.Response) => {
  try {
    const { payday } = req.body;
    const paydayNum = Number(payday);
    if (!payday || isNaN(paydayNum) || paydayNum < 1 || paydayNum > 31) {
      return res.status(400).json({ error: 'Tanggal gajian tidak valid. Harus angka antara 1 dan 31.' });
    }
    const user = await db.updateUserPayday(req.userId, paydayNum);
    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memperbarui tanggal gajian' });
  }
});

app.post('/api/auth/logout', async (req: express.Request, res: express.Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    await db.deleteSession(token);
  }
  res.json({ success: true });
});

app.get('/api/transactions', authMiddleware, async (req: any, res: express.Response) => {
  try {
    const transactions = await db.getTransactions(req.userId);
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data transaksi' });
  }
});

app.post('/api/transactions', authMiddleware, async (req: any, res: express.Response) => {
  const { title, amount, type, category, date } = req.body;
  if (!title || typeof amount !== 'number' || !type || !category || !date) {
    return res.status(400).json({ error: 'Semua kolom transaksi harus diisi lengkap dan valid' });
  }
  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({ error: 'Tipe transaksi harus income atau expense' });
  }
  try {
    const tx = await db.createTransaction(req.userId, { title, amount, type, category, date });
    res.status(201).json(tx);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mencatat transaksi' });
  }
});

app.put('/api/transactions/:id', authMiddleware, async (req: any, res: express.Response) => {
  const { id } = req.params;
  const { title, amount, type, category, date } = req.body;
  try {
    const tx = await db.updateTransaction(req.userId, id, { title, amount, type, category, date });
    if (!tx) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan atau Anda tidak memiliki akses' });
    }
    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: 'Gagal memperbarui transaksi' });
  }
});

app.delete('/api/transactions/:id', authMiddleware, async (req: any, res: express.Response) => {
  const { id } = req.params;
  try {
    const deleted = await db.deleteTransaction(req.userId, id);
    if (!deleted) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan atau Anda tidak memiliki akses' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus transaksi' });
  }
});

app.get('/api/analysis', authMiddleware, async (req: any, res: express.Response) => {
  try {
    const transactions = await db.getTransactions(req.userId);

    let totalIncome = 0;
    let totalExpense = 0;
    let totalRoutineExpense = 0;
    let totalNonRoutineExpense = 0;
    const categoryTotals: { [cat: string]: number } = {};
    const expensesByDay: { [date: string]: number } = {};
    const routineExpensesByDay: { [date: string]: number } = {};

    transactions.forEach(t => {
      const val = Number(t.amount);
      if (t.type === 'income') {
        totalIncome += val;
      } else {
        totalExpense += val;
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + val;
        expensesByDay[t.date] = (expensesByDay[t.date] || 0) + val;
        const isRoutine = ['makanan', 'transportasi', 'kesehatan'].includes(t.category);
        if (isRoutine) {
          totalRoutineExpense += val;
          routineExpensesByDay[t.date] = (routineExpensesByDay[t.date] || 0) + val;
        } else {
          totalNonRoutineExpense += val;
        }
      }
    });

    const currentBalance = totalIncome - totalExpense;
    const daysWithExpenses = Object.keys(expensesByDay).length;
    const daysWithRoutine = Object.keys(routineExpensesByDay).length;

    let dailyAverageRoutine = 0;
    if (daysWithRoutine > 0) {
      dailyAverageRoutine = totalRoutineExpense / daysWithRoutine;
    } else if (totalRoutineExpense > 0) {
      dailyAverageRoutine = totalRoutineExpense / 30;
    } else if (totalExpense > 0) {
      dailyAverageRoutine = totalExpense / 30;
    }

    const dailyAverageAll = daysWithExpenses > 0 ? (totalExpense / daysWithExpenses) : (totalExpense / 30);
    const dailyAverage = dailyAverageRoutine;

    const user = await db.getUserById(req.userId);
    const paydayDay = (user && user.payday) ? user.payday : 25;
    const today = new Date();
    const currentDay = today.getDate();
    let daysUntilPayday = 0;
    if (currentDay < paydayDay) {
      daysUntilPayday = paydayDay - currentDay;
    } else {
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      daysUntilPayday = (daysInMonth - currentDay) + paydayDay;
    }

    const projectedExpense = Math.round(dailyAverage * daysUntilPayday);
    const isDeficit = currentBalance < projectedExpense;
    const deficitOrSurplusAmount = Math.abs(currentBalance - projectedExpense);

    // Breakdown kategori LENGKAP (bukan cuma top category) untuk konteks AI
    const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
    const topCategory = sortedCategories.length > 0 ? sortedCategories[0][0] : 'Belum Ada';
    const topCategoryAmount = sortedCategories.length > 0 ? sortedCategories[0][1] : 0;

    const categoryBreakdownText = sortedCategories.length > 0
      ? sortedCategories.map(([cat, amt]) => `  - ${cat}: Rp${amt.toLocaleString('id-ID')}`).join('\n')
      : '  (belum ada data pengeluaran)';

    // 8 transaksi terakhir sebagai konteks konkret buat AI (bukan cuma angka agregat)
    const recentTxText = transactions.slice(0, 8).length > 0
      ? transactions.slice(0, 8).map(t =>
          `  - ${t.date} | ${t.title} (${t.category}) | ${t.type === 'income' ? '+' : '-'}Rp${t.amount.toLocaleString('id-ID')}`
        ).join('\n')
      : '  (belum ada transaksi tercatat)';

    const dataConfidenceLabel = daysWithRoutine <= 2
      ? 'RENDAH (data masih sangat sedikit, kurang dari 3 hari tercatat)'
      : daysWithRoutine <= 7
      ? 'SEDANG (kurang dari seminggu data)'
      : 'TINGGI (data cukup untuk proyeksi yang wajar)';

    let healthScore: 'Aman' | 'Peringatan' | 'Bahaya' = 'Aman';
    if (isDeficit) {
      healthScore = 'Bahaya';
    } else if (currentBalance < projectedExpense * 1.3) {
      healthScore = 'Peringatan';
    }

    const fallbackParams = {
      healthScore, isDeficit, currentBalance, totalNonRoutineExpense,
      dailyAverageRoutine, projectedExpense, daysUntilPayday,
      deficitOrSurplusAmount, topCategory, topCategoryAmount, daysWithRoutine,
    };

    let advice: AiAdvice;

    try {
      const ai = getGeminiClient();
      const prompt = `
Analisis keuangan pengguna (dalam mata uang Rupiah):
- Saldo Sekarang: Rp ${currentBalance.toLocaleString('id-ID')}
- Total Pemasukan: Rp ${totalIncome.toLocaleString('id-ID')}
- Total Pengeluaran: Rp ${totalExpense.toLocaleString('id-ID')}
- Pengeluaran Rutin (Makanan, Transportasi, Kesehatan): Rp ${totalRoutineExpense.toLocaleString('id-ID')}
- Pengeluaran Non-Rutin (Belanja, Tagihan, Hiburan): Rp ${totalNonRoutineExpense.toLocaleString('id-ID')}
- Rata-rata Pengeluaran Rutin Harian: Rp ${dailyAverageRoutine.toLocaleString('id-ID')}/hari
- Hari Menuju Gajian (tanggal ${paydayDay}): ${daysUntilPayday} hari
- Proyeksi Pengeluaran Rutin s/d Gajian: Rp ${projectedExpense.toLocaleString('id-ID')}
- Status Proyeksi: ${isDeficit ? `DEFISIT sebesar Rp ${deficitOrSurplusAmount.toLocaleString('id-ID')}` : `SURPLUS sebesar Rp ${deficitOrSurplusAmount.toLocaleString('id-ID')}`}
- Tingkat Keyakinan Data: ${dataConfidenceLabel}

Breakdown Pengeluaran per Kategori:
${categoryBreakdownText}

Transaksi Terakhir (maks 8):
${recentTxText}

Ingat: proyeksi di atas HANYA mengalikan pengeluaran RUTIN harian dengan sisa hari menuju gajian — pengeluaran non-rutin (tagihan bulanan, belanja besar, hiburan sesekali) TIDAK diasumsikan berulang setiap hari.

Berikan analisis mengikuti format terstruktur yang diminta. Gunakan transaksi terakhir di atas untuk membuat saran yang spesifik, bukan generik.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: ANALYSIS_RESPONSE_SCHEMA,
        },
      });

      const parsed = JSON.parse(response.text || '{}');

      if (!isValidAdvice(parsed)) {
        throw new Error('Struktur respons AI tidak valid');
      }

      advice = {
        summary: parsed.summary,
        confidenceNote: parsed.confidenceNote || '',
        tips: parsed.tips.slice(0, 3),
        motivationalQuote: parsed.motivationalQuote,
      };
    } catch (aiErr: any) {
      console.error('Gemini API call failed or returned invalid data, using rule-based fallback:', aiErr);
      advice = generateFallbackAdvice(fallbackParams);
    }

    res.json({
      status: 'ok',
      analysis: {
        balance: currentBalance,
        totalIncome,
        totalExpense,
        dailyAverage: Math.round(dailyAverage),
        daysUntilPayday,
        projectedExpense,
        isDeficit,
        deficitOrSurplusAmount,
        topCategory,
        topCategoryAmount,
        healthScore,
        // Objek terstruktur, bukan string markdown bebas
        savingAdvice: advice,
        paydayDay,
        totalRoutineExpense,
        totalNonRoutineExpense,
        dailyAverageRoutine: Math.round(dailyAverageRoutine),
        dailyAverageAll: Math.round(dailyAverageAll),
      },
    });
  } catch (err) {
    console.error('Analysis endpoint error:', err);
    res.status(500).json({ error: 'Gagal melakukan analisis finansial' });
  }
});

// Vercel akan memanggil Express app ini langsung sebagai handler(req, res)
export default app;