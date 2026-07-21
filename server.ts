import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { db } from './server-db.js';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

// Port must be exactly 3000
const PORT = 3000;

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

async function startServer() {
  const app = express();
  app.use(express.json());

  // Database Initialization
  await db.init();

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

  // --- API ROUTES ---

  // Auth: Register
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

  // Auth: Login
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

  // Auth: Get Current User
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

  // User: Update Payday Date
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

  // User: Update Profile (username, email)
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

  // Auth: Logout
  app.post('/api/auth/logout', async (req: express.Request, res: express.Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await db.deleteSession(token);
    }
    res.json({ success: true });
  });

  // Transactions: Get List (strict RLS)
  app.get('/api/transactions', authMiddleware, async (req: any, res: express.Response) => {
    try {
      const transactions = await db.getTransactions(req.userId);
      res.json({ transactions });
    } catch (err) {
      res.status(500).json({ error: 'Gagal mengambil data transaksi' });
    }
  });

  // Transactions: Create (strict RLS)
  app.post('/api/transactions', authMiddleware, async (req: any, res: express.Response) => {
    const { title, amount, type, category, date } = req.body;
    if (!title || typeof amount !== 'number' || !type || !category || !date) {
      return res.status(400).json({ error: 'Semua kolom transaksi harus diisi lengkap dan valid' });
    }
    if (type !== 'income' && type !== 'expense') {
      return res.status(400).json({ error: 'Tipe transaksi harus income atau expense' });
    }
    try {
      const tx = await db.createTransaction(req.userId, {
        title,
        amount,
        type,
        category,
        date,
      });
      res.status(201).json(tx);
    } catch (err) {
      res.status(500).json({ error: 'Gagal mencatat transaksi' });
    }
  });

  // Transactions: Update (strict RLS)
  app.put('/api/transactions/:id', authMiddleware, async (req: any, res: express.Response) => {
    const { id } = req.params;
    const { title, amount, type, category, date } = req.body;
    try {
      const tx = await db.updateTransaction(req.userId, id, {
        title,
        amount,
        type,
        category,
        date,
      });
      if (!tx) {
        return res.status(404).json({ error: 'Transaksi tidak ditemukan atau Anda tidak memiliki akses' });
      }
      res.json(tx);
    } catch (err) {
      res.status(500).json({ error: 'Gagal memperbarui transaksi' });
    }
  });

  // Transactions: Delete (strict RLS)
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

  // Predictive Smart Advice Engine (isolated analysis to prevent data leakage in network panel)
  app.get('/api/analysis', authMiddleware, async (req: any, res: express.Response) => {
    try {
      const transactions = await db.getTransactions(req.userId);

      // 1. Calculate Core Financial Metrics with Smart Categorization (Routine vs Non-Routine)
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

          // 'makanan', 'transportasi', 'kesehatan' are defined as routine/daily expenses
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

      // Days with expenses calculation
      const daysWithExpenses = Object.keys(expensesByDay).length;
      const daysWithRoutine = Object.keys(routineExpensesByDay).length;

      // Smart Routine Daily Average:
      // If we only have 1 active day, let's divide totalRoutineExpense by 1.
      // But we also calculate an amortized daily average for safety if there are no routine expenses recorded yet.
      let dailyAverageRoutine = 0;
      if (daysWithRoutine > 0) {
        dailyAverageRoutine = totalRoutineExpense / daysWithRoutine;
      } else if (totalRoutineExpense > 0) {
        dailyAverageRoutine = totalRoutineExpense / 30;
      } else if (totalExpense > 0) {
        // Fallback: if there are no routine expenses, but there are non-routine ones, 
        // let's distribute totalExpense over 30 days so we don't project huge daily spikes.
        dailyAverageRoutine = totalExpense / 30;
      }

      const dailyAverageAll = daysWithExpenses > 0 ? (totalExpense / daysWithExpenses) : (totalExpense / 30);

      // We use dailyAverageRoutine for the projection because repeating huge, 
      // one-time items like "Healing" or "Tagihan" daily is unrealistic!
      const dailyAverage = dailyAverageRoutine;

      // 2. Payday Deficit Analysis
      const user = await db.getUserById(req.userId);
      const paydayDay = (user && user.payday) ? user.payday : 25;
      const today = new Date();
      const currentDay = today.getDate();
      let daysUntilPayday = 0;

      if (currentDay < paydayDay) {
        daysUntilPayday = paydayDay - currentDay;
      } else {
        // Days left in the current month + days until payday in next month
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        daysUntilPayday = (daysInMonth - currentDay) + paydayDay;
      }

      const projectedExpense = Math.round(dailyAverage * daysUntilPayday);
      const isDeficit = currentBalance < projectedExpense;
      const deficitOrSurplusAmount = Math.abs(currentBalance - projectedExpense);

      // Find top custom category (paling boros)
      let topCategory = 'Belum Ada';
      let topCategoryAmount = 0;
      Object.entries(categoryTotals).forEach(([cat, amt]) => {
        if (amt > topCategoryAmount) {
          topCategory = cat;
          topCategoryAmount = amt;
        }
      });

      // Simple heuristic for health status
      let healthScore: 'Aman' | 'Peringatan' | 'Bahaya' = 'Aman';
      if (isDeficit) {
        healthScore = 'Bahaya';
      } else if (currentBalance < projectedExpense * 1.3) {
        healthScore = 'Peringatan';
      }

      // 3. Consult Gemini API for Smart Advice
      let savingAdvice = '';
      try {
        const ai = getGeminiClient();
        const prompt = `
          Analisis keuangan pengguna (dalam mata uang Rupiah):
          - Saldo Sekarang: Rp ${currentBalance.toLocaleString('id-ID')}
          - Total Pemasukan: Rp ${totalIncome.toLocaleString('id-ID')}
          - Total Pengeluaran: Rp ${totalExpense.toLocaleString('id-ID')}
          - Pengeluaran Rutin (Makanan, Bensin/Transportasi, Kesehatan): Rp ${totalRoutineExpense.toLocaleString('id-ID')}
          - Pengeluaran Non-Rutin/Besar (Belanja, Tagihan, Hiburan/Healing): Rp ${totalNonRoutineExpense.toLocaleString('id-ID')}
          - Rata-rata Pengeluaran Rutin Harian: Rp ${dailyAverageRoutine.toLocaleString('id-ID')}/hari
          - Hari Menuju Gajian (tanggal ${paydayDay}): ${daysUntilPayday} hari
          - Proyeksi Pengeluaran Rutin sampai Gajian: Rp ${projectedExpense.toLocaleString('id-ID')}
          - Prediksi Status Keuangan s/d Gajian: ${isDeficit ? `MINUS/DEFISIT sebesar Rp ${deficitOrSurplusAmount.toLocaleString('id-ID')}` : `SURPLUS sebesar Rp ${deficitOrSurplusAmount.toLocaleString('id-ID')}`}
          - Kategori Paling Boros: ${topCategory} (Total: Rp ${topCategoryAmount.toLocaleString('id-ID')})

          PENTING: Pengguna sempat bingung karena jika mereka mencatat pengeluaran besar satu kali (seperti "Healing" atau tagihan bulanan), sistem lama mengasumsikannya berulang setiap hari sehingga menghasilkan angka proyeksi minus puluhan juta yang tidak realistis.
          Kini, kami memisahkan pengeluaran menjadi RUTIN (makanan, transportasi, dll) dan NON-RUTIN (tagihan bulanan, belanja besar, hiburan sekali-sekali yang TIDAK berulang setiap hari). Proyeksi masa depan di atas HANYA mengalikan pengeluaran RUTIN harian dengan sisa hari menuju gajian.
          
          Harap berikan respon analitis yang cerdas dalam Bahasa Indonesia dengan format markdown:
          1. Kalimat analisis singkat yang berempati namun realistis tentang kondisi keuangan mereka saat ini. Jelaskan secara ramah bahwa pengeluaran besar seperti "Healing" atau "Tagihan" adalah pengeluaran non-rutin yang dihitung sekali (tidak harian), sehingga proyeksi keuangan mereka saat ini jauh lebih akurat dan rasional (Hanya mengalikan pengeluaran harian rutin seperti makanan & bensin).
          2. Berikan maksimal 3 saran/tips penghematan cerdas yang konkret, berfokus terutama pada kategori paling boros (${topCategory}) agar mereka terhindar dari defisit atau bisa menabung lebih banyak.
          3. Satu kalimat kutipan motivasi keuangan yang menginspirasi.
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            systemInstruction: 'Anda adalah konsultan keuangan pribadi AI (BufferFin Advisor) yang ramah, profesional, dan memberikan saran penghematan berbasis data nyata yang sangat praktis bagi masyarakat Indonesia.',
          },
        });

        savingAdvice = response.text || '';
      } catch (aiErr: any) {
        console.error('Gemini API call failed, using rule-based generator:', aiErr);
        // Fallback rule-based advice if Gemini is unavailable or key is not set
        savingAdvice = `### Analisis Finansial BufferFin (Smart Model)
Kondisi keuangan Anda saat ini masuk dalam kategori **${healthScore}**. Kami mendeteksi Anda melakukan pengeluaran besar satu-kali/bulanan sebesar **Rp ${totalNonRoutineExpense.toLocaleString('id-ID')}** (seperti Tagihan atau Hiburan/Healing) yang tidak berulang setiap hari.

Untuk itu, kami telah menyesuaikan kalkulasi proyeksi secara cerdas:
- **Rerata Pengeluaran Rutin:** Rp ${Math.round(dailyAverageRoutine).toLocaleString('id-ID')} /hari (Makanan, Transportasi, Kesehatan).
- **Proyeksi Rutin s/d Gajian (${daysUntilPayday} hari lagi):** Rp ${projectedExpense.toLocaleString('id-ID')}.
- **Status Saldo Sekarang:** Rp ${currentBalance.toLocaleString('id-ID')}.

${isDeficit ? `⚠️ **Peringatan Defisit:** Dengan saldo saat ini Rp ${currentBalance.toLocaleString('id-ID')}, Anda diproyeksikan akan mengalami defisit kebutuhan rutin sebesar sekitar **Rp ${deficitOrSurplusAmount.toLocaleString('id-ID')}** sebelum hari gajian.` : `Sisa saldo Anda diperkirakan aman untuk meng-cover kebutuhan rutin hingga hari gajian dengan potensi surplus sekitar **Rp ${deficitOrSurplusAmount.toLocaleString('id-ID')}**.`}

#### 💡 Saran Penghematan Cerdas:
1. **Bedakan Kebutuhan & Keinginan (Primer vs Sekunder):** Pengeluaran non-rutin seperti *${topCategory === 'hiburan' ? 'Hiburan & Hobi' : topCategory === 'tagihan' ? 'Tagihan & Utilitas' : topCategory === 'belanja' ? 'Belanja' : topCategory === 'makanan' ? 'Makanan' : topCategory}* (Rp ${topCategoryAmount.toLocaleString('id-ID')}) adalah pengeluaran terbesar Anda saat ini. Batasi hiburan/belanja non-esensial hingga gajian tiba.
2. **Amankan Anggaran Rutin:** Prioritaskan sisa dana Anda untuk kebutuhan pokok harian seperti Makanan dan Transportasi terlebih dahulu.
3. **Atur Tanggal Gajian yang Akurat:** Pastikan siklus gajian Anda sudah diatur dengan benar agar kalkulasi hari menuju gajian lebih presisi.

*"Menghemat satu rupiah hari ini berarti mengamankan kebebasan finansial Anda di masa depan."*`;
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
          savingAdvice,
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

  // --- VITE DEV SERVER OR STATIC SERVING ---

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FinTrack Backend] Server is running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
