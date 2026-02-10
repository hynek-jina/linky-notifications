import {
  SimplePool,
  nip19,
  type Filter,
  type Event as NostrEvent,
} from "nostr-tools";
import type { Subscription } from "./db.js";

const DEFAULT_RELAYS = [
  "wss://nos.lol",
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
];

export class NostrListener {
  private pool: SimplePool;
  private subscriptions: Map<string, { close: () => void }> = new Map();
  private lastChecks: Map<string, number> = new Map();

  constructor() {
    this.pool = new SimplePool();
  }

  async subscribeToUser(
    subscription: Subscription,
    onMessage: (event: NostrEvent, npub: string) => void,
  ): Promise<void> {
    const { npub, relays, lastCheck } = subscription;
    this.lastChecks.set(npub, lastCheck);

    // Decode npub to hex pubkey
    let pubkey: string;
    try {
      const decoded = nip19.decode(npub);
      if (decoded.type !== "npub") return;
      pubkey = decoded.data as string;
    } catch (error) {
      console.error(`Invalid npub: ${npub}`);
      return;
    }

    // Use user's relays or defaults
    const userRelays = relays.length > 0 ? relays.slice(0, 3) : DEFAULT_RELAYS;

    const subscribe = () => {
      const filter: Filter = {
        kinds: [4, 1059],
        "#p": [pubkey],
        since: this.lastChecks.get(npub) ?? lastCheck,
      };

      const sub = this.pool.subscribeMany(userRelays, filter as any, {
        onevent: (event: NostrEvent) => {
          onMessage(event, npub);
        },
        onclose: () => {
          console.log(`Subscription closed for ${npub}, reconnecting in 5s...`);
          // Reconnect after 5 seconds
          setTimeout(() => {
            if (this.subscriptions.has(npub)) {
              subscribe();
            }
          }, 5000);
        },
      });
      this.subscriptions.set(npub, sub as any);
    };

    subscribe();
    console.log(`Subscribed to ${npub} on ${userRelays.join(", ")}`);
  }

  unsubscribeUser(npub: string): void {
    const sub = this.subscriptions.get(npub);
    if (sub) {
      sub.close();
      this.subscriptions.delete(npub);
      this.lastChecks.delete(npub);
      console.log(`Unsubscribed from ${npub}`);
    }
  }

  updateLastCheck(npub: string, timestamp: number): void {
    this.lastChecks.set(npub, timestamp);
  }

  async fetchSenderMetadata(
    senderPubkey: string,
    relays: string[],
  ): Promise<{ name?: string; display_name?: string } | null> {
    try {
      const filter: Filter = {
        kinds: [0],
        authors: [senderPubkey],
        limit: 1,
      };

      const events = await this.pool.querySync(relays, filter, {
        maxWait: 2000,
      });
      if (events.length > 0) {
        return JSON.parse(events[0].content);
      }
    } catch (error) {
      console.error("Error fetching sender metadata:", error);
    }
    return null;
  }

  close(): void {
    this.subscriptions.forEach((sub) => sub.close());
    this.subscriptions.clear();
    this.lastChecks.clear();
  }
}
