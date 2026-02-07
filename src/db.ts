import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Subscription {
  npub: string;
  subscription: PushSubscription;
  relays: string[];
  lastCheck: number;
  updatedAt: number;
}

export interface PushSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'subscriptions.db');
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        npub TEXT PRIMARY KEY,
        subscription TEXT NOT NULL,
        relays TEXT NOT NULL,
        lastCheck INTEGER DEFAULT 0,
        updatedAt INTEGER DEFAULT 0
      )
    `);
  }

  addSubscription(subscription: Subscription): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO subscriptions (npub, subscription, relays, lastCheck, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      subscription.npub,
      JSON.stringify(subscription.subscription),
      JSON.stringify(subscription.relays),
      subscription.lastCheck,
      subscription.updatedAt
    );
  }

  removeSubscription(npub: string): void {
    const stmt = this.db.prepare('DELETE FROM subscriptions WHERE npub = ?');
    stmt.run(npub);
  }

  getSubscription(npub: string): Subscription | null {
    const stmt = this.db.prepare('SELECT * FROM subscriptions WHERE npub = ?');
    const row = stmt.get(npub) as any;
    if (!row) return null;
    return this.rowToSubscription(row);
  }

  getAllSubscriptions(): Subscription[] {
    const stmt = this.db.prepare('SELECT * FROM subscriptions');
    const rows = stmt.all() as any[];
    return rows.map(row => this.rowToSubscription(row));
  }

  updateLastCheck(npub: string, timestamp: number): void {
    const stmt = this.db.prepare(`
      UPDATE subscriptions SET lastCheck = ?, updatedAt = ? WHERE npub = ?
    `);
    stmt.run(timestamp, Date.now(), npub);
  }

  private rowToSubscription(row: any): Subscription {
    return {
      npub: row.npub,
      subscription: JSON.parse(row.subscription),
      relays: JSON.parse(row.relays),
      lastCheck: row.lastCheck,
      updatedAt: row.updatedAt,
    };
  }

  close(): void {
    this.db.close();
  }
}

export const db = new DatabaseManager();
