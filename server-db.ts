import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  payday?: number; // Payday date (1 to 31, default 25)
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

class LocalDB {
  private data: DatabaseSchema = {
    users: [],
    transactions: [],
    sessions: {},
  };
  private isLoaded = false;

  async init() {
    if (this.isLoaded) return;
    try {
      await fs.access(DB_FILE);
      const raw = await fs.readFile(DB_FILE, 'utf-8');
      this.data = JSON.parse(raw);
      // Ensure collections exist
      if (!this.data.users) this.data.users = [];
      if (!this.data.transactions) this.data.transactions = [];
      if (!this.data.sessions) this.data.sessions = {};
    } catch {
      // File does not exist, initialize and save
      await this.save();
    }
    this.isLoaded = true;
    console.log('LocalDB initialized successfully');
  }

  private async save() {
    try {
      await fs.writeFile(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save LocalDB to file:', err);
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
    await this.init();
    const cleanEmail = email.trim().toLowerCase();
    const existing = this.data.users.find(u => u.email === cleanEmail);
    if (existing) {
      throw new Error('Email sudah terdaftar');
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      email: cleanEmail,
      passwordHash: this.hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    this.data.users.push(newUser);
    await this.save();

    const { passwordHash, ...safeUser } = newUser;
    return safeUser;
  }

  async loginUser(email: string, password: string): Promise<Omit<User, 'passwordHash'> | null> {
    await this.init();
    const cleanEmail = email.trim().toLowerCase();
    const user = this.data.users.find(u => u.email === cleanEmail);
    if (!user) return null;

    if (this.verifyPassword(password, user.passwordHash)) {
      const { passwordHash, ...safeUser } = user;
      return safeUser;
    }
    return null;
  }

  async getUserById(userId: string): Promise<Omit<User, 'passwordHash'> | null> {
    await this.init();
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return null;
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async updateUserPayday(userId: string, payday: number): Promise<Omit<User, 'passwordHash'> | null> {
    await this.init();
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return null;
    user.payday = payday;
    await this.save();
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // Session Management
  async createSession(userId: string): Promise<string> {
    await this.init();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    this.data.sessions[token] = { userId, expiresAt };
    await this.save();
    return token;
  }

  async validateSession(token: string): Promise<string | null> {
    await this.init();
    const session = this.data.sessions[token];
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      delete this.data.sessions[token];
      await this.save();
      return null;
    }
    return session.userId;
  }

  async deleteSession(token: string): Promise<void> {
    await this.init();
    if (this.data.sessions[token]) {
      delete this.data.sessions[token];
      await this.save();
    }
  }

  // Transaction Management (with strict user ownership checks)
  async getTransactions(userId: string): Promise<Transaction[]> {
    await this.init();
    return this.data.transactions
      .filter(t => t.user_id === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async createTransaction(userId: string, transaction: Omit<Transaction, 'id' | 'user_id'>): Promise<Transaction> {
    await this.init();
    const newTransaction: Transaction = {
      ...transaction,
      id: crypto.randomUUID(),
      user_id: userId,
    };
    this.data.transactions.push(newTransaction);
    await this.save();
    return newTransaction;
  }

  async updateTransaction(userId: string, id: string, updates: Partial<Omit<Transaction, 'id' | 'user_id'>>): Promise<Transaction | null> {
    await this.init();
    const index = this.data.transactions.findIndex(t => t.id === id && t.user_id === userId);
    if (index === -1) return null;

    const updated = {
      ...this.data.transactions[index],
      ...updates,
      id, // ensure ID is not changed
      user_id: userId, // ensure user_id is not changed
    };

    this.data.transactions[index] = updated;
    await this.save();
    return updated;
  }

  async deleteTransaction(userId: string, id: string): Promise<boolean> {
    await this.init();
    const initialLength = this.data.transactions.length;
    this.data.transactions = this.data.transactions.filter(t => !(t.id === id && t.user_id === userId));
    const wasDeleted = this.data.transactions.length < initialLength;
    if (wasDeleted) {
      await this.save();
    }
    return wasDeleted;
  }
}

export const db = new LocalDB();
