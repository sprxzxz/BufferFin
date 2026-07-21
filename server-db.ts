import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

export const isSupabaseEnabled = !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

if (isSupabaseEnabled) {
  console.log('🔌 Connected to Supabase DB (Production/Online mode)');
} else {
  console.log('📂 Connected to local db.json (Development/Local mode)');
}

const supabase = isSupabaseEnabled ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  payday?: number; // Payday date (1 to 31, default 25)
  username?: string; // Custom username/display name
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

interface DatabaseSchema {
  users: User[];
  transactions: Transaction[];
  sessions: { [token: string]: { userId: string; expiresAt: number } };
}

const DB_FILE = path.join(process.cwd(), 'db.json');

// Mappers for Supabase to ensure safe column name translations
function mapUser(dbUser: any): User {
  if (!dbUser) return null as any;
  return {
    id: dbUser.id,
    email: dbUser.email,
    passwordHash: dbUser.password_hash || dbUser.passwordHash || '',
    createdAt: dbUser.created_at || dbUser.createdAt || new Date().toISOString(),
    payday: dbUser.payday ?? 25,
    username: dbUser.username || '',
  };
}

function mapTransaction(dbTx: any): Transaction {
  if (!dbTx) return null as any;
  return {
    id: dbTx.id,
    user_id: dbTx.user_id || dbTx.userId || '',
    title: dbTx.title || '',
    amount: Number(dbTx.amount || 0),
    type: dbTx.type || 'expense',
    category: dbTx.category || '',
    date: dbTx.date || '',
  };
}

class HybridDB {
  private localData: DatabaseSchema = {
    users: [],
    transactions: [],
    sessions: {},
  };
  private isLocalLoaded = false;

  async init() {
    // Compatibility method for server startup.
    // Local DB will lazily initialize itself when needed,
    // and Supabase is initialized on client creation.
    if (!isSupabaseEnabled) {
      await this.initLocal();
    }
  }

  private async initLocal() {
    if (this.isLocalLoaded) return;
    try {
      await fs.access(DB_FILE);
      const raw = await fs.readFile(DB_FILE, 'utf-8');
      this.localData = JSON.parse(raw);
      if (!this.localData.users) this.localData.users = [];
      if (!this.localData.transactions) this.localData.transactions = [];
      if (!this.localData.sessions) this.localData.sessions = {};
    } catch {
      await this.saveLocal();
    }
    this.isLocalLoaded = true;
  }

  private async saveLocal() {
    try {
      await fs.writeFile(DB_FILE, JSON.stringify(this.localData, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save LocalDB:', err);
    }
  }

  // Password hashing helpers
  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, stored: string): boolean {
    const parts = stored.split(':');
    if (parts.length !== 2) return false;
    const [salt, hash] = parts;
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  // User Management
  async registerUser(email: string, password: string): Promise<Omit<User, 'passwordHash'>> {
    const cleanEmail = email.trim().toLowerCase();

    if (isSupabaseEnabled && supabase) {
      // 1. Check existing
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existing) {
        throw new Error('Email sudah terdaftar');
      }

      const passwordHash = this.hashPassword(password);
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          email: cleanEmail,
          password_hash: passwordHash,
          payday: 25,
        })
        .select()
        .single();

      if (error || !newUser) {
        throw new Error(error?.message || 'Registrasi gagal di Supabase');
      }

      const safeUser = mapUser(newUser);
      const { passwordHash: _, ...result } = safeUser;
      return result;
    } else {
      await this.initLocal();
      const existing = this.localData.users.find(u => u.email === cleanEmail);
      if (existing) {
        throw new Error('Email sudah terdaftar');
      }

      const newUser: User = {
        id: crypto.randomUUID(),
        email: cleanEmail,
        passwordHash: this.hashPassword(password),
        createdAt: new Date().toISOString(),
        payday: 25,
      };

      this.localData.users.push(newUser);
      await this.saveLocal();

      const { passwordHash, ...safeUser } = newUser;
      return safeUser;
    }
  }

  async loginUser(email: string, password: string): Promise<Omit<User, 'passwordHash'> | null> {
    const cleanEmail = email.trim().toLowerCase();

    if (isSupabaseEnabled && supabase) {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (error || !user) return null;

      const mappedUser = mapUser(user);
      if (this.verifyPassword(password, mappedUser.passwordHash)) {
        const { passwordHash, ...safeUser } = mappedUser;
        return safeUser;
      }
      return null;
    } else {
      await this.initLocal();
      const user = this.localData.users.find(u => u.email === cleanEmail);
      if (!user) return null;

      if (this.verifyPassword(password, user.passwordHash)) {
        const { passwordHash, ...safeUser } = user;
        return safeUser;
      }
      return null;
    }
  }

  async getUserById(userId: string): Promise<Omit<User, 'passwordHash'> | null> {
    if (isSupabaseEnabled && supabase) {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !user) return null;
      const mappedUser = mapUser(user);
      const { passwordHash, ...safeUser } = mappedUser;
      return safeUser;
    } else {
      await this.initLocal();
      const user = this.localData.users.find(u => u.id === userId);
      if (!user) return null;
      const { passwordHash, ...safeUser } = user;
      return safeUser;
    }
  }

  async updateUserPayday(userId: string, payday: number): Promise<Omit<User, 'passwordHash'> | null> {
    if (isSupabaseEnabled && supabase) {
      const { data: user, error } = await supabase
        .from('users')
        .update({ payday })
        .eq('id', userId)
        .select()
        .single();

      if (error || !user) return null;
      const mappedUser = mapUser(user);
      const { passwordHash, ...safeUser } = mappedUser;
      return safeUser;
    } else {
      await this.initLocal();
      const user = this.localData.users.find(u => u.id === userId);
      if (!user) return null;
      user.payday = payday;
      await this.saveLocal();
      const { passwordHash, ...safeUser } = user;
      return safeUser;
    }
  }

  async updateUserProfile(userId: string, username: string, email: string): Promise<Omit<User, 'passwordHash'> | null> {
    const cleanEmail = email.trim().toLowerCase();

    if (isSupabaseEnabled && supabase) {
      // Check if email is already taken by ANOTHER user
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', cleanEmail)
        .neq('id', userId)
        .maybeSingle();

      if (existing) {
        throw new Error('Email sudah terdaftar oleh pengguna lain');
      }

      const { data: user, error } = await supabase
        .from('users')
        .update({ username, email: cleanEmail })
        .eq('id', userId)
        .select()
        .single();

      if (error || !user) {
        throw new Error(error?.message || 'Gagal memperbarui profil di Supabase');
      }
      const mappedUser = mapUser(user);
      const { passwordHash, ...safeUser } = mappedUser;
      return safeUser;
    } else {
      await this.initLocal();
      const existing = this.localData.users.find(u => u.email === cleanEmail && u.id !== userId);
      if (existing) {
        throw new Error('Email sudah terdaftar oleh pengguna lain');
      }

      const user = this.localData.users.find(u => u.id === userId);
      if (!user) return null;

      user.username = username;
      user.email = cleanEmail;
      await this.saveLocal();

      const { passwordHash, ...safeUser } = user;
      return safeUser;
    }
  }

  // Session Management
  async createSession(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    if (isSupabaseEnabled && supabase) {
      const { error } = await supabase
        .from('sessions')
        .insert({
          token,
          user_id: userId,
          expires_at: expiresAt,
        });

      if (error) {
        console.error('Failed to save session to Supabase:', error);
      }
      return token;
    } else {
      await this.initLocal();
      this.localData.sessions[token] = { userId, expiresAt };
      await this.saveLocal();
      return token;
    }
  }

  async validateSession(token: string): Promise<string | null> {
    if (isSupabaseEnabled && supabase) {
      const { data: session, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (error || !session) return null;

      if (Date.now() > Number(session.expires_at)) {
        await supabase.from('sessions').delete().eq('token', token);
        return null;
      }
      return session.user_id;
    } else {
      await this.initLocal();
      const session = this.localData.sessions[token];
      if (!session) return null;
      if (Date.now() > session.expiresAt) {
        delete this.localData.sessions[token];
        await this.saveLocal();
        return null;
      }
      return session.userId;
    }
  }

  async deleteSession(token: string): Promise<void> {
    if (isSupabaseEnabled && supabase) {
      await supabase.from('sessions').delete().eq('token', token);
    } else {
      await this.initLocal();
      if (this.localData.sessions[token]) {
        delete this.localData.sessions[token];
        await this.saveLocal();
      }
    }
  }

  // Transaction Management
  async getTransactions(userId: string): Promise<Transaction[]> {
    if (isSupabaseEnabled && supabase) {
      const { data: txs, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error || !txs) return [];
      return txs.map(mapTransaction);
    } else {
      await this.initLocal();
      return this.localData.transactions
        .filter(t => t.user_id === userId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  }

  async createTransaction(userId: string, transaction: Omit<Transaction, 'id' | 'user_id'>): Promise<Transaction> {
    if (isSupabaseEnabled && supabase) {
      const { data: newTx, error } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          title: transaction.title,
          amount: transaction.amount,
          type: transaction.type,
          category: transaction.category,
          date: transaction.date,
        })
        .select()
        .single();

      if (error || !newTx) {
        throw new Error(error?.message || 'Gagal menambahkan transaksi di Supabase');
      }
      return mapTransaction(newTx);
    } else {
      await this.initLocal();
      const newTransaction: Transaction = {
        ...transaction,
        id: crypto.randomUUID(),
        user_id: userId,
      };
      this.localData.transactions.push(newTransaction);
      await this.saveLocal();
      return newTransaction;
    }
  }

  async updateTransaction(userId: string, id: string, updates: Partial<Omit<Transaction, 'id' | 'user_id'>>): Promise<Transaction | null> {
    if (isSupabaseEnabled && supabase) {
      const updateData: any = {};
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.date !== undefined) updateData.date = updates.date;

      const { data: updatedTx, error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (error || !updatedTx) return null;
      return mapTransaction(updatedTx);
    } else {
      await this.initLocal();
      const index = this.localData.transactions.findIndex(t => t.id === id && t.user_id === userId);
      if (index === -1) return null;

      const updated = {
        ...this.localData.transactions[index],
        ...updates,
        id,
        user_id: userId,
      };

      this.localData.transactions[index] = updated;
      await this.saveLocal();
      return updated;
    }
  }

  async deleteTransaction(userId: string, id: string): Promise<boolean> {
    if (isSupabaseEnabled && supabase) {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      return !error;
    } else {
      await this.initLocal();
      const initialLength = this.localData.transactions.length;
      this.localData.transactions = this.localData.transactions.filter(t => !(t.id === id && t.user_id === userId));
      const wasDeleted = this.localData.transactions.length < initialLength;
      if (wasDeleted) {
        await this.saveLocal();
      }
      return wasDeleted;
    }
  }
}

export const db = new HybridDB();
