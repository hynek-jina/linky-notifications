import { createClient, type Client } from '@libsql/client';

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
  private client: Client;
  private initialized: boolean = false;

  constructor() {
    const url = process.env.TURSO_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error('TURSO_URL and TURSO_AUTH_TOKEN must be set');
    }

    this.client = createClient({ url, authToken });
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        npub TEXT PRIMARY KEY,
        subscription TEXT NOT NULL,
        relays TEXT NOT NULL,
        lastCheck INTEGER DEFAULT 0,
        updatedAt INTEGER DEFAULT 0
      )
    `);

    this.initialized = true;
  }

  async addSubscription(subscription: Subscription): Promise<void> {
    await this.init();
    
    await this.client.execute({
      sql: `
        INSERT OR REPLACE INTO subscriptions (npub, subscription, relays, lastCheck, updatedAt)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [
        subscription.npub,
        JSON.stringify(subscription.subscription),
        JSON.stringify(subscription.relays),
        subscription.lastCheck,
        subscription.updatedAt
      ]
    });
  }

  async removeSubscription(npub: string): Promise<void> {
    await this.init();
    
    await this.client.execute({
      sql: 'DELETE FROM subscriptions WHERE npub = ?',
      args: [npub]
    });
  }

  async getSubscription(npub: string): Promise<Subscription | null> {
    await this.init();
    
    const result = await this.client.execute({
      sql: 'SELECT * FROM subscriptions WHERE npub = ?',
      args: [npub]
    });

    if (result.rows.length === 0) return null;
    return this.rowToSubscription(result.rows[0]);
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    await this.init();
    
    const result = await this.client.execute('SELECT * FROM subscriptions');
    return result.rows.map(row => this.rowToSubscription(row));
  }

  async updateLastCheck(npub: string, timestamp: number): Promise<void> {
    await this.init();
    
    await this.client.execute({
      sql: 'UPDATE subscriptions SET lastCheck = ?, updatedAt = ? WHERE npub = ?',
      args: [timestamp, Date.now(), npub]
    });
  }

  private rowToSubscription(row: any): Subscription {
    return {
      npub: row.npub as string,
      subscription: JSON.parse(row.subscription as string),
      relays: JSON.parse(row.relays as string),
      lastCheck: row.lastCheck as number,
      updatedAt: row.updatedAt as number,
    };
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export const db = new DatabaseManager();
