export interface User {
  id: string;
  email: string;
  createdAt: string;
  payday?: number;
  username?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string; // YYYY-MM-DD
}

export interface Analysis {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  dailyAverage: number;
  daysUntilPayday: number;
  projectedExpense: number;
  isDeficit: boolean;
  deficitOrSurplusAmount: number;
  topCategory: string;
  topCategoryAmount: number;
  healthScore: 'Aman' | 'Peringatan' | 'Bahaya';
  savingAdvice: string;
  paydayDay?: number;
  totalRoutineExpense?: number;
  totalNonRoutineExpense?: number;
  dailyAverageRoutine?: number;
  dailyAverageAll?: number;
}

export const CATEGORIES = [
  { value: 'makanan', label: 'Makanan & Minuman', color: '#14b8a6', icon: 'Utensils' },
  { value: 'transportasi', label: 'Transportasi', color: '#3b82f6', icon: 'Car' },
  { value: 'belanja', label: 'Belanja & Shopping', color: '#ec4899', icon: 'ShoppingBag' },
  { value: 'tagihan', label: 'Tagihan & Utilitas', color: '#f59e0b', icon: 'Lightbulb' },
  { value: 'hiburan', label: 'Hiburan & Hobi', color: '#8b5cf6', icon: 'Sparkles' },
  { value: 'kesehatan', label: 'Kesehatan', color: '#ef4444', icon: 'HeartPulse' },
  { value: 'pendidikan', label: 'Pendidikan', color: '#10b981', icon: 'GraduationCap' },
  { value: 'lainnya', label: 'Lainnya', color: '#6b7280', icon: 'HelpCircle' },
];

export const CATEGORY_MAP: { [key: string]: { label: string; color: string; icon: string } } = {
  makanan: { label: 'Makanan & Minuman', color: '#14b8a6', icon: 'Utensils' },
  transportasi: { label: 'Transportasi', color: '#3b82f6', icon: 'Car' },
  belanja: { label: 'Belanja & Shopping', color: '#ec4899', icon: 'ShoppingBag' },
  tagihan: { label: 'Tagihan & Utilitas', color: '#f59e0b', icon: 'Lightbulb' },
  hiburan: { label: 'Hiburan & Hobi', color: '#8b5cf6', icon: 'Sparkles' },
  kesehatan: { label: 'Kesehatan', color: '#ef4444', icon: 'HeartPulse' },
  pendidikan: { label: 'Pendidikan', color: '#10b981', icon: 'GraduationCap' },
  lainnya: { label: 'Lainnya', color: '#6b7280', icon: 'HelpCircle' },
};
