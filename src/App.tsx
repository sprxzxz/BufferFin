import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Utensils,
  Car,
  ShoppingBag,
  Lightbulb,
  Sparkles,
  HeartPulse,
  GraduationCap,
  HelpCircle,
  Plus,
  Edit2,
  Trash2,
  LogOut,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Brain,
  Search,
  Filter,
  User as UserIcon,
  X,
  TrendingUp as ArrowUpRight,
  TrendingDown as ArrowDownRight,
} from 'lucide-react';
import { CATEGORIES, CATEGORY_MAP, Transaction, Analysis, User } from './types';

const formatRupiah = (num: number): string => {
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export default function App() {
  // Session & User State
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('bufferfin_token'));
  const [email, setEmail] = useState<string | null>(() => localStorage.getItem('bufferfin_email'));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(false);

  // Payday Editing State
  const [isEditingPayday, setIsEditingPayday] = useState(false);
  const [tempPayday, setTempPayday] = useState('25');
  
  // App States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  
  // UI Loaders
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Transaction Form State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txCategory, setTxCategory] = useState('makanan');
  const [txDate, setTxDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [txError, setTxError] = useState('');
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  // Load user data on startup or login
  useEffect(() => {
    if (token) {
      fetchCurrentUser();
      fetchTransactions();
      fetchAnalysis();
    } else {
      setCurrentUser(null);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    setIsUserLoading(true);
    try {
      const data = await apiFetch('/api/auth/me');
      setCurrentUser(data.user);
    } catch (err) {
      console.error('Failed to fetch current user profile:', err);
    } finally {
      setIsUserLoading(false);
    }
  };

  // Network Fetching helper with Auth headers
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    };
    
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      // Session expired
      handleLogout();
      throw new Error('Sesi Anda telah berakhir, silakan login kembali.');
    }
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Terjadi kesalahan sistem.');
    }
    return data;
  };

  // Auth Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setIsAuthLoading(true);

    if (!authEmail.trim() || !authPassword) {
      setAuthError('Email dan password wajib diisi');
      setIsAuthLoading(false);
      return;
    }

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      localStorage.setItem('bufferfin_token', res.token);
      localStorage.setItem('bufferfin_email', res.user.email);
      setToken(res.token);
      setEmail(res.user.email);
      setCurrentUser(res.user);
      setAuthSuccess(authMode === 'login' ? 'Login berhasil!' : 'Registrasi berhasil!');
      // reset forms
      setAuthEmail('');
      setAuthPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Proses otentikasi gagal');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      }
    } catch (e) {
      console.warn('Logout server request failed, clearing local storage anyway.');
    }
    localStorage.removeItem('bufferfin_token');
    localStorage.removeItem('bufferfin_email');
    setToken(null);
    setEmail(null);
    setTransactions([]);
    setAnalysis(null);
  };

  const handleSetPaydayOnboarding = async (paydayNum: number) => {
    try {
      const data = await apiFetch('/api/user/payday', {
        method: 'PUT',
        body: JSON.stringify({ payday: paydayNum }),
      });
      setCurrentUser(data.user);
      fetchAnalysis();
    } catch (err: any) {
      console.error('Failed to set payday date:', err);
    }
  };

  // Transaction Actions
  const fetchTransactions = async () => {
    setIsDataLoading(true);
    try {
      const data = await apiFetch('/api/transactions');
      setTransactions(data.transactions);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDataLoading(false);
    }
  };

  const fetchAnalysis = async () => {
    setIsAnalysisLoading(true);
    try {
      const data = await apiFetch('/api/analysis');
      setAnalysis(data.analysis);
    } catch (err) {
      console.error('Error fetching financial analysis:', err);
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingTx(null);
    setTxTitle('');
    setTxAmount('');
    setTxType('expense');
    setTxCategory('makanan');
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxError('');
    setShowFormModal(true);
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setTxTitle(tx.title);
    setTxAmount(formatRupiah(tx.amount));
    setTxType(tx.type);
    setTxCategory(tx.category);
    setTxDate(tx.date);
    setTxError('');
    setShowFormModal(true);
  };

  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxError('');
    setIsSubmittingTx(true);

    const parsedAmount = parseFloat(txAmount.replace(/[^0-9]/g, ''));
    if (!txTitle.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      setTxError('Harap masukkan deskripsi dan jumlah uang yang valid.');
      setIsSubmittingTx(false);
      return;
    }

    try {
      const payload = {
        title: txTitle.trim(),
        amount: parsedAmount,
        type: txType,
        category: txType === 'income' ? 'lainnya' : txCategory,
        date: txDate,
      };

      if (editingTx) {
        await apiFetch(`/api/transactions/${editingTx.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setShowFormModal(false);
      // Refresh transactions list and AI predictive insights
      await fetchTransactions();
      await fetchAnalysis();
    } catch (err: any) {
      setTxError(err.message || 'Gagal menyimpan transaksi.');
    } finally {
      setIsSubmittingTx(false);
    }
  };

  const handleDeleteTx = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) return;
    try {
      await apiFetch(`/api/transactions/${id}`, {
        method: 'DELETE',
      });
      await fetchTransactions();
      await fetchAnalysis();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus transaksi.');
    }
  };

  // Helper: Get Icon Component based on Name
  const getCategoryIcon = (categoryName: string, type: 'income' | 'expense') => {
    if (type === 'income') return <TrendingUp className="w-5 h-5 text-emerald-400" />;
    
    switch (categoryName) {
      case 'makanan': return <Utensils className="w-4 h-4" />;
      case 'transportasi': return <Car className="w-4 h-4" />;
      case 'belanja': return <ShoppingBag className="w-4 h-4" />;
      case 'tagihan': return <Lightbulb className="w-4 h-4" />;
      case 'hiburan': return <Sparkles className="w-4 h-4" />;
      case 'kesehatan': return <HeartPulse className="w-4 h-4" />;
      case 'pendidikan': return <GraduationCap className="w-4 h-4" />;
      default: return <HelpCircle className="w-4 h-4" />;
    }
  };

  // Filters calculation
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || tx.category === filterCategory;
    const matchesType = filterType === 'all' || tx.type === filterType;
    return matchesSearch && matchesCategory && matchesType;
  });

  // Calculate expense chart data from actual backend analysis or client data
  const expenseCategories = transactions.filter(t => t.type === 'expense');
  const expenseTotal = expenseCategories.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
  
  const categoryAgregates = expenseCategories.reduce((acc: { [cat: string]: number }, tx: Transaction) => {
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {});

  const chartData = Object.entries(categoryAgregates).map(([cat, val]) => {
    const amount = Number(val);
    const info = CATEGORY_MAP[cat] || { label: cat, color: '#6b7280' };
    const percentage = expenseTotal > 0 ? (amount / expenseTotal) * 100 : 0;
    return {
      category: cat,
      label: info.label,
      amount,
      percentage,
      color: info.color,
    };
  }).sort((a, b) => b.amount - a.amount);

  // Health score customization
  const getHealthBannerDetails = (score: 'Aman' | 'Peringatan' | 'Bahaya') => {
    switch (score) {
      case 'Bahaya':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          indicator: 'bg-rose-500',
          icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
          label: 'Bahaya Defisit',
          desc: 'Rata-rata pengeluaran Anda terlalu tinggi dibanding sisa saldo sebelum gajian.',
        };
      case 'Peringatan':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          indicator: 'bg-amber-500',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          label: 'Peringatan Hemat',
          desc: 'Kondisi keuangan cukup ketat. Kurangi pengeluaran non-primer Anda.',
        };
      default:
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          indicator: 'bg-emerald-500',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
          label: 'Kondisi Aman',
          desc: 'Pengeluaran harian terkontrol dengan baik dan sisa saldo terproyeksi aman.',
        };
    }
  };

  // Render Authentication Screen
  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center p-4 font-sans selection:bg-indigo-600 selection:text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_45%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.06),transparent_45%)] pointer-events-none" />

        <div className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
          
          {/* Logo */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-64 h-16 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 80" className="w-full h-full">
                <defs>
                  {/* Gradasi untuk ikon perisai */}
                  <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  {/* Gradasi untuk panah tren keuangan */}
                  <linearGradient id="arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>

                {/* IKON LOGO */}
                <g transform="translate(10, 10)">
                  {/* Perisai Buffer (Latar Belakang) */}
                  <path d="M30 0 C48 0 56 6 60 14 C60 36 48 52 30 60 C12 52 0 36 0 14 C4 6 12 0 30 0 Z" fill="url(#shieldGrad)" />
                  {/* Lapisan perisai dalam untuk efek ketebalan/buffer */}
                  <path d="M30 5 C44 5 51 10 55 17 C55 35 44 48 30 55 C16 48 5 35 5 17 C9 10 16 5 30 5 Z" fill="#064E3B" opacity="0.3" />
                  {/* Panah Tren Finansial (Depan) */}
                  <path d="M22 42 L22 32 L14 32 L14 24 L28 24 L28 14 L44 28 L28 42 Z" fill="url(#arrowGrad)" transform="rotate(-45 30 28)" />
                </g>

                {/* TEKS MERK */}
                <g transform="translate(85, 48)">
                  <text fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="28" fill="#FFFFFF" letterSpacing="-0.5">
                    Buffer<tspan fill="#10B981">Fin</tspan>
                  </text>
                </g>
              </svg>
            </div>
            <p className="text-[10px] text-zinc-500 mt-2 uppercase tracking-widest font-medium">
              Manajemen Keuangan & Saran Prediktif AI Cerdas
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                Email Anda
              </label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                Kata Sandi (Password)
              </label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 transition-colors text-sm"
              />
            </div>

            <AnimatePresence mode="wait">
              {authError && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-xs flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </motion.div>
              )}
              {authSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-xs flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{authSuccess}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isAuthLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isAuthLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : authMode === 'login' ? (
                'Masuk ke Akun'
              ) : (
                'Daftar Akun Baru'
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-8 text-center border-t border-zinc-800 pt-6">
            <p className="text-xs text-zinc-400">
              {authMode === 'login' ? 'Belum punya akun BufferFin?' : 'Sudah memiliki akun?'}
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setAuthError('');
                  setAuthSuccess('');
                }}
                className="ml-1 text-indigo-400 hover:text-indigo-300 font-bold focus:outline-none underline decoration-indigo-500/40 hover:decoration-indigo-400"
              >
                {authMode === 'login' ? 'Daftar Sekarang' : 'Masuk di Sini'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 1. If token is present but user details are loading, show a loading screen
  if (token && !currentUser && isUserLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm text-zinc-400 font-medium">Memuat profil akun Anda...</p>
      </div>
    );
  }

  // 2. If token is present and user details are loaded, but payday is not set yet (New registered user flow)
  if (token && currentUser && !currentUser.payday) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center p-4 font-sans selection:bg-indigo-600 selection:text-white relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
          
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 mb-4 shadow-inner">
              <Sparkles className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Selamat Datang di BufferFin! 👋
            </h1>
            <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">
              Halo <span className="text-zinc-200 font-semibold">{currentUser.email}</span>. Silakan isi data tanggal gajian bulanan Anda untuk memulai analisis keuangan cerdas berbasis AI.
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const selectEl = e.currentTarget.elements.namedItem('paydayInput') as HTMLSelectElement;
              const val = Number(selectEl.value);
              if (val >= 1 && val <= 31) {
                await handleSetPaydayOnboarding(val);
              }
            }}
            className="space-y-6"
          >
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
                Pilih Tanggal Gajian Bulanan Anda
              </label>
              
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
                <select
                  name="paydayInput"
                  defaultValue="25"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-10 py-3.5 text-zinc-200 text-sm font-bold focus:outline-none focus:border-indigo-500/60 transition-colors cursor-pointer appearance-none"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>Tanggal {day} setiap bulan</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-[10px]">
                  ▼
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 mt-2.5 leading-relaxed">
                Informasi ini tersimpan aman di profil Anda dan dapat disesuaikan kembali kapan saja secara langsung melalui dasbor.
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-zinc-950 font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-500/10 text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              Simpan & Masuk ke Dasbor
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Active Dashboard Screen
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-indigo-600 selection:text-white pb-16">
      {/* Decorative Blur Ambient */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-zinc-800/10 blur-[100px] rounded-full pointer-events-none" />

      {/* HEADER BAR */}
      <header className="sticky top-0 z-40 bg-zinc-900/50 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-full h-full">
                <defs>
                  <linearGradient id="favShield" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <linearGradient id="favArrow" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
                {/* Perisai Buffer */}
                <path d="M32 2 C50 2 58 8 62 16 C62 38 50 54 32 62 C14 54 2 38 2 16 C6 8 14 2 32 2 Z" fill="url(#favShield)" />
                {/* Panah Finansial */}
                <path d="M24 44 L24 34 L16 34 L16 26 L30 26 L30 16 L46 32 L30 48 Z" fill="url(#favArrow)" transform="rotate(-45 32 30)" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Buffer<span className="text-emerald-400">Fin</span> <span className="text-zinc-500 font-normal text-xs">v2.0</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2.5 bg-zinc-950 px-3.5 py-1.5 rounded-full border border-zinc-800 text-xs text-zinc-400 font-medium">
              <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>{email}</span>
              {currentUser?.payday && (
                <>
                  <span className="w-[1px] h-3 bg-zinc-800" />
                  <span className="text-emerald-400 text-[11px] font-bold">Gajian: Tgl {currentUser.payday}</span>
                </>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-zinc-700 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* DASHBOARD CONTENT CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* BANNER KESEHATAN KEUANGAN */}
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-8 border rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl ${getHealthBannerDetails(analysis.healthScore).bg}`}
          >
            <div className="flex items-center gap-3.5">
              {getHealthBannerDetails(analysis.healthScore).icon}
              <div>
                <div className="font-bold text-sm sm:text-base flex items-center gap-2">
                  <span>Saran Sistem BufferFin:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase text-zinc-950 ${getHealthBannerDetails(analysis.healthScore).indicator}`}>
                    {getHealthBannerDetails(analysis.healthScore).label}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 mt-1 font-medium">
                  {getHealthBannerDetails(analysis.healthScore).desc}
                </p>
              </div>
            </div>

            {/* Quick action button */}
            <button
              onClick={openAddModal}
              className="bg-zinc-900 hover:bg-zinc-800 text-indigo-400 hover:text-indigo-300 font-medium text-xs px-4 py-2.5 rounded-xl border border-zinc-800 transition-all shadow-md shrink-0 cursor-pointer"
            >
              + Catat Keuangan Baru
            </button>
          </motion.div>
        )}

        {/* FINANCIAL SUMMARY METRICS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          
          {/* Card: Balance */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden shadow-lg group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-2xl rounded-full" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Saldo Sekarang</span>
              <div className="p-2 rounded-xl bg-indigo-950/40 border border-indigo-500/20">
                <Wallet className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Rp {analysis ? formatRupiah(analysis.balance) : '0'}
            </h3>
            <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1 font-medium">
              Sisa uang bersih saat ini
            </p>
          </div>

          {/* Card: Total Income */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden shadow-lg group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Total Pemasukan</span>
              <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight">
              Rp {analysis ? formatRupiah(analysis.totalIncome) : '0'}
            </h3>
            <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1 font-medium">
              Uang masuk terdaftar
            </p>
          </div>

          {/* Card: Total Expense */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden shadow-lg group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-2xl rounded-full" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Total Pengeluaran</span>
              <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-500/20">
                <TrendingDown className="w-5 h-5 text-rose-400" />
              </div>
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-rose-400 tracking-tight">
              Rp {analysis ? formatRupiah(analysis.totalExpense) : '0'}
            </h3>
            <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1 font-medium">
              Uang keluar dibelanjakan
            </p>
          </div>

          {/* Card: Daily Average */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden shadow-lg group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-2xl rounded-full" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Rerata Pengeluaran Rutin</span>
              <div className="p-2 rounded-xl bg-indigo-950/40 border border-indigo-500/20">
                <Calendar className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-indigo-400 tracking-tight">
              Rp {analysis ? formatRupiah(analysis.dailyAverage) : '0'} <span className="text-xs text-zinc-500 font-bold">/hari</span>
            </h3>
            <div className="text-[11px] text-zinc-400 mt-2 font-medium flex flex-col gap-0.5">
              <span>Hanya menghitung pengeluaran rutin harian</span>
              <span className="text-[10px] text-zinc-500">(Makanan, Transportasi, Kesehatan)</span>
              {analysis && analysis.dailyAverageAll !== undefined && analysis.dailyAverageAll !== analysis.dailyAverage && (
                <span className="text-[10px] text-zinc-500 mt-1.5 pt-1.5 border-t border-zinc-800/60 block">
                  Rerata kotor semua pengeluaran: <b className="text-zinc-300">Rp {formatRupiah(analysis.dailyAverageAll)}/hari</b> (termasuk tagihan & belanja besar)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* MAIN ANALYSIS & CHART SYSTEM */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          
          {/* AI SMART PREDICTIVE ADVISOR CONTAINER (2 COLS LARGE) */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            
            {/* Glowing AI Panel */}
            <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden shadow-2xl flex flex-col h-full">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-500/10 to-transparent blur-3xl rounded-full pointer-events-none" />
              
              {/* Advisor Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="p-2.5 rounded-xl bg-indigo-600/30 border border-indigo-500/30">
                      <Brain className="w-5 h-5 text-indigo-400 animate-pulse" />
                    </div>
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-400 border-2 border-zinc-950 rounded-full" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      Analisis Prediktif AI BufferFin
                    </h2>
                    <span className="text-xs text-zinc-400 font-medium">
                      Menggunakan model cerdas server-side
                    </span>
                  </div>
                </div>

                <button
                  onClick={fetchAnalysis}
                  disabled={isAnalysisLoading}
                  className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer border border-zinc-800 disabled:opacity-50"
                  title="Refresh Analisis"
                >
                  <RefreshCw className={`w-4 h-4 ${isAnalysisLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Prediction stats block */}
              {analysis && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between relative group">
                    <div className="flex items-start justify-between gap-3 w-full">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Hari Menuju Gajian</span>
                        <span className="text-base sm:text-lg font-bold text-zinc-200 mt-1 block">
                          {analysis.daysUntilPayday} Hari Lagi
                        </span>
                        
                        {!isEditingPayday ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] text-zinc-400 block truncate">
                              Siklus Gajian Tanggal {analysis.paydayDay || currentUser?.payday || 25}
                            </span>
                            <button
                              onClick={() => {
                                setTempPayday(String(analysis.paydayDay || currentUser?.payday || 25));
                                setIsEditingPayday(true);
                              }}
                              className="p-1 text-indigo-400 hover:text-indigo-300 rounded hover:bg-zinc-900 transition-colors cursor-pointer"
                              title="Ubah Siklus Gajian"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-1">
                            <select
                              value={tempPayday}
                              onChange={(e) => setTempPayday(e.target.value)}
                              className="bg-zinc-900 border border-zinc-800 text-zinc-200 rounded px-1 py-0.5 text-[10px] focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                            >
                              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                <option key={d} value={d}>Tgl {d}</option>
                              ))}
                            </select>
                            <button
                              onClick={async () => {
                                const val = Number(tempPayday);
                                if (val >= 1 && val <= 31) {
                                  try {
                                    const data = await apiFetch('/api/user/payday', {
                                      method: 'PUT',
                                      body: JSON.stringify({ payday: val }),
                                    });
                                    setCurrentUser(data.user);
                                    setIsEditingPayday(false);
                                    fetchAnalysis();
                                  } catch (err: any) {
                                    console.error(err);
                                  }
                                }
                              }}
                              className="px-1.5 py-0.5 bg-indigo-600 text-white font-bold rounded text-[9px] hover:bg-indigo-500 transition-colors cursor-pointer"
                            >
                              Simpan
                            </button>
                            <button
                              onClick={() => setIsEditingPayday(false)}
                              className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[9px] hover:bg-zinc-700 transition-colors cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 shrink-0">
                        <Calendar className="w-5 h-5 text-indigo-400" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Proyeksi Kebutuhan Rutin</span>
                      <span className="text-base sm:text-lg font-bold text-zinc-200 mt-1 block">
                        Rp {formatRupiah(analysis.projectedExpense)}
                      </span>
                      <span className="text-[10px] text-zinc-400 mt-0.5 block truncate">
                        Estimasi s/d gajian ({analysis.daysUntilPayday} hari lagi)
                      </span>
                    </div>
                    <div className={`p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 ${analysis.isDeficit ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {analysis.isDeficit ? <TrendingDown className="w-5 h-5 text-rose-400" /> : <TrendingUp className="w-5 h-5 text-emerald-400" />}
                    </div>
                  </div>
                </div>
              )}

              {/* AI Markdown Advice Content */}
              <div className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-xl p-5 overflow-y-auto max-h-[300px] sm:max-h-[360px] text-xs sm:text-sm leading-relaxed text-zinc-300">
                {isAnalysisLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                    <p className="text-xs font-semibold">Menganalisis pengeluaran Anda dan merumuskan strategi hemat...</p>
                  </div>
                ) : analysis && analysis.savingAdvice ? (
                  <div className="prose prose-invert prose-xs max-w-none space-y-4">
                    {/* Parse simple markdown line by line to support customized headers and paragraphs nicely inside pure React */}
                    {analysis.savingAdvice.split('\n').map((line, idx) => {
                      const trimmed = line.trim();
                      if (trimmed.startsWith('###')) {
                        return <h4 key={idx} className="text-sm font-bold text-indigo-300 mt-3 border-b border-zinc-800 pb-1">{trimmed.replace('###', '')}</h4>;
                      }
                      if (trimmed.startsWith('####')) {
                        return <h5 key={idx} className="text-xs font-bold text-indigo-400 mt-2 uppercase tracking-wide">{trimmed.replace('####', '')}</h5>;
                      }
                      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                        return <p key={idx} className="text-zinc-100 font-semibold">{trimmed.replace(/\*\*/g, '')}</p>;
                      }
                      if (trimmed.startsWith('*') && trimmed.endsWith('*')) {
                        return <blockquote key={idx} className="border-l-2 border-indigo-500/40 pl-3 italic text-indigo-200/90 py-1 bg-indigo-500/5 rounded-r-lg">{trimmed.replace(/\*/g, '')}</blockquote>;
                      }
                      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                        // highlight keyword
                        const content = trimmed.replace(/^[-*]\s*/, '');
                        return (
                           <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-1">
                             <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0 animate-pulse" />
                             <span>{content}</span>
                           </div>
                        );
                      }
                      if (trimmed.match(/^\d+\./)) {
                        const content = trimmed.replace(/^\d+\.\s*/, '');
                        return (
                          <div key={idx} className="flex items-start gap-2.5 my-2.5 pl-1">
                            <span className="font-bold text-indigo-400 text-xs mt-0.5 shrink-0 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-md">
                              {trimmed.match(/^\d+/)?.[0]}
                            </span>
                            <span>{content}</span>
                          </div>
                        );
                      }
                      if (!trimmed) return <div key={idx} className="h-2" />;
                      return <p key={idx}>{line}</p>;
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-center gap-3">
                    <AlertCircle className="w-7 h-7 text-zinc-600" />
                    <div>
                      <p className="font-bold">Data Keuangan Masih Kosong</p>
                      <p className="text-[11px] mt-1 text-zinc-600">Catat pemasukan dan pengeluaran Anda agar AI dapat memberikan analisis prediktif.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* CATEGORY BREAKDOWN SYSTEM (1 COL) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-white mb-1">Breakdown Pengeluaran</h3>
              <p className="text-[10px] text-zinc-500 mb-6 uppercase tracking-widest font-medium">Berdasarkan kategori pengeluaran Anda</p>

              {expenseTotal === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-3 text-center">
                  <TrendingDown className="w-7 h-7 text-zinc-600" />
                  <div>
                    <p className="font-bold">Belum Ada Pengeluaran</p>
                    <p className="text-[11px] mt-0.5 text-zinc-600">Catat pengeluaran baru untuk melihat rincian.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  
                  {/* Visual mini SVG chart donut */}
                  <div className="flex justify-center my-4">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="50"
                        stroke="rgba(39, 39, 42, 0.6)"
                        strokeWidth="12"
                        fill="transparent"
                      />
                      {(() => {
                        let accumulatedOffset = 0;
                        return chartData.map((item, idx) => {
                          const circumference = 2 * Math.PI * 50;
                          const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
                          const strokeDashoffset = -accumulatedOffset;
                          accumulatedOffset += (item.percentage / 100) * circumference;
                          return (
                            <circle
                              key={idx}
                              cx="64"
                              cy="64"
                              r="50"
                              stroke={item.color}
                              strokeWidth="12"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              fill="transparent"
                              className="transition-all duration-300 hover:stroke-[14px]"
                            >
                              <title>{`${item.label}: ${item.percentage.toFixed(1)}%`}</title>
                            </circle>
                          );
                        });
                      })()}
                    </svg>
                  </div>

                  {/* Progressive Categories List */}
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {chartData.map((item, index) => {
                      return (
                        <div key={index} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-zinc-300 flex items-center gap-1.5 truncate">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                              {item.label}
                            </span>
                            <span className="text-zinc-200 tabular-nums font-bold">
                              {item.percentage.toFixed(0)}%
                            </span>
                          </div>
                          
                          {/* Progress line */}
                          <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                            />
                          </div>
                          <span className="text-[10px] text-zinc-500 font-bold block text-right tabular-nums">
                            Rp {formatRupiah(item.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Total Expense footer */}
            {expenseTotal > 0 && (
              <div className="border-t border-zinc-800 pt-4 mt-6 flex items-center justify-between text-xs text-zinc-500 font-semibold">
                <span>Total Belanja Pengeluaran:</span>
                <span className="text-rose-400 font-bold text-sm sm:text-base tabular-nums">
                  Rp {formatRupiah(expenseTotal)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* TRANSACTIONS LOGGER SECTION */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-zinc-800 pb-6">
            <div>
              <h2 className="font-bold text-white">Riwayat Catatan Keuangan</h2>
              <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-widest font-medium">Lihat, cari, saring, dan perbarui catatan Anda</p>
            </div>

            {/* Search, Filter & Trigger */}
            <div className="flex flex-wrap items-center gap-2.5">
              
              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari transaksi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors w-full sm:w-48"
                />
              </div>

              {/* Category filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-indigo-500/50 transition-colors"
              >
                <option value="all">Semua Kategori</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>

              {/* Type filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-indigo-500/50 transition-colors"
              >
                <option value="all">Semua Tipe</option>
                <option value="income">Pemasukan (+)</option>
                <option value="expense">Pengeluaran (-)</option>
              </select>

              {/* Trigger Modal Add */}
              <button
                onClick={openAddModal}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Tambah Catatan
              </button>
            </div>
          </div>

          {/* Transactions List Container */}
          <div className="overflow-hidden">
            {isDataLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                <p className="text-xs font-semibold">Mengambil data catatan finansial...</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-center gap-3">
                <AlertCircle className="w-8 h-8 text-zinc-600" />
                <div>
                  <p className="font-bold">Catatan Tidak Ditemukan</p>
                  <p className="text-[11px] mt-0.5 text-zinc-600">Silakan tambahkan catatan keuangan baru atau ubah filter pencarian Anda.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      <th className="pb-3 pl-4">Tanggal & Deskripsi</th>
                      <th className="pb-3">Kategori</th>
                      <th className="pb-3 text-right">Jumlah Uang</th>
                      <th className="pb-3 text-right pr-4">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredTransactions.map((tx) => {
                      const isIncome = tx.type === 'income';
                      const categoryInfo = CATEGORY_MAP[tx.category] || { label: 'Lainnya', color: '#6b7280' };
                      
                      return (
                        <tr key={tx.id} className="group hover:bg-zinc-950/40 transition-colors">
                          <td className="py-4 pl-4 pr-3">
                            <div className="flex items-center gap-3.5">
                              {/* circular icon indicator */}
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 transition-colors"
                                style={{
                                  backgroundColor: isIncome ? 'rgba(16, 185, 129, 0.08)' : `${categoryInfo.color}15`,
                                  borderColor: isIncome ? 'rgba(16, 185, 129, 0.15)' : `${categoryInfo.color}30`,
                                }}
                              >
                                <span style={{ color: isIncome ? '#34d399' : categoryInfo.color }}>
                                  {getCategoryIcon(tx.category, tx.type)}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs sm:text-sm font-bold text-zinc-200 block truncate group-hover:text-indigo-400 transition-colors">
                                  {tx.title}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-bold tracking-wide mt-0.5 block flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-zinc-600" />
                                  {new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 pr-3">
                            {isIncome ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Pemasukan
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border"
                                style={{
                                  backgroundColor: `${categoryInfo.color}10`,
                                  borderColor: `${categoryInfo.color}25`,
                                  color: categoryInfo.color,
                                }}
                              >
                                {categoryInfo.label}
                              </span>
                            )}
                          </td>
                          <td className="py-4 pr-3 text-right">
                            <span className={`text-xs sm:text-sm font-bold tabular-nums block ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isIncome ? '+' : '-'} Rp {formatRupiah(tx.amount)}
                            </span>
                          </td>
                          <td className="py-4 pr-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-65 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditModal(tx)}
                                className="p-2 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-850 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-zinc-800"
                                title="Ubah Catatan"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTx(tx.id)}
                                className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-zinc-850 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-zinc-800"
                                title="Hapus Catatan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* TRANSACTION INPUT MODAL FORM */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Backdrop cover */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFormModal(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />

            {/* Modal Card content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative z-10"
            >
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
              
              <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="font-bold text-white">
                  {editingTx ? 'Edit Catatan Transaksi' : 'Catat Transaksi Baru'}
                </h3>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTxSubmit} className="p-6 space-y-4">
                
                {/* Form: Type (Income / Expense) toggle */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                    Tipe Transaksi
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setTxType('expense')}
                      className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${txType === 'expense' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow' : 'text-zinc-500'}`}
                    >
                      Pengeluaran (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxType('income')}
                      className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${txType === 'income' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow' : 'text-zinc-500'}`}
                    >
                      Pemasukan (+)
                    </button>
                  </div>
                </div>

                {/* Form: Title */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                    Deskripsi / Judul
                  </label>
                  <input
                    type="text"
                    required
                    value={txTitle}
                    onChange={(e) => setTxTitle(e.target.value)}
                    placeholder="Contoh: Makan Siang, Gajian Pokok..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>

                {/* Form: Amount */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                    Jumlah Uang (Rupiah)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">Rp</span>
                    <input
                      type="text"
                      required
                      value={txAmount}
                      onChange={(e) => {
                        // numeric only input formatting
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val) {
                          setTxAmount(formatRupiah(Number(val)));
                        } else {
                          setTxAmount('');
                        }
                      }}
                      placeholder="0"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-2.5 text-zinc-200 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                </div>

                {/* Form: Category selector (only for Expense) */}
                {txType === 'expense' && (
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                      Kategori Pengeluaran
                    </label>
                    <select
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Form: Date */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>

                {txError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{txError}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold py-2.5 px-4 rounded-xl transition-colors text-xs cursor-pointer border border-zinc-800"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTx}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow text-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isSubmittingTx ? (
                      <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                    ) : (
                      'Simpan Catatan'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
