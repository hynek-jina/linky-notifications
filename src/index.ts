import cors from "cors";
import express from "express";
import type { Event as NostrEvent } from "nostr-tools";
import { nip19 } from "nostr-tools";
import { db, type Subscription } from "./db.js";
import { NostrListener } from "./nostr.js";
import {
  isSubscriptionExpired,
  sendNotification,
  type NotificationPayload,
} from "./push.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Nostr listener
const nostrListener = new NostrListener();

// Track active subscriptions
const activeSubscriptions = new Map<string, Subscription>();

function normalizeRelays(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((relay) => typeof relay === "string")
    .map((relay) => relay.trim())
    .filter((relay) => relay.startsWith("wss://") || relay.startsWith("ws://"))
    .slice(0, 3);
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Subscribe endpoint
app.post("/subscribe", async (req, res) => {
  try {
    const { npub, subscription, relays } = req.body;

    if (!npub || !npub.startsWith("npub1") || npub.length < 20) {
      return res.status(400).json({ error: "Invalid npub" });
    }

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Invalid subscription" });
    }

    const subscriptionData: Subscription = {
      npub,
      subscription,
      relays: normalizeRelays(relays),
      lastCheck: Math.floor(Date.now() / 1000),
      updatedAt: Date.now(),
    };

    // Save to database
    await db.addSubscription(subscriptionData);

    // Subscribe to Nostr events
    nostrListener.subscribeToUser(subscriptionData, handleNewMessage);
    activeSubscriptions.set(npub, subscriptionData);

    console.log(`New subscription: ${npub}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Subscribe error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Unsubscribe endpoint
app.post("/unsubscribe", async (req, res) => {
  try {
    const { npub } = req.body;

    if (!npub) {
      return res.status(400).json({ error: "Invalid npub" });
    }

    // Remove from database
    await db.removeSubscription(npub);

    // Unsubscribe from Nostr
    nostrListener.unsubscribeUser(npub);
    activeSubscriptions.delete(npub);

    console.log(`Unsubscribed: ${npub}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Handle new Nostr message
async function handleNewMessage(
  event: NostrEvent,
  npub: string,
): Promise<void> {
  try {
    const subscription = await db.getSubscription(npub);
    if (!subscription) return;

    // Get sender info
    const senderMetadata = await nostrListener.fetchSenderMetadata(
      event.pubkey,
      subscription.relays.length > 0 ? subscription.relays : ["wss://nos.lol"],
    );

    const senderName =
      senderMetadata?.display_name || senderMetadata?.name || "Kontakt";

    // Note: Server cannot read message content for encrypted messages (NIP-17 gift wrap)
    // We only know a message arrived, not its content
    // Build simple notification without message content
    const payload: NotificationPayload = {
      title: `${senderName}`,
      body: "New message", // Generic message - content is encrypted
      data: {
        type: "dm",
        contactNpub: nip19.npubEncode(event.pubkey),
      },
    };

    // Send push notification
    try {
      await sendNotification(subscription.subscription, payload);
      console.log(`Notification sent to ${npub}`);
    } catch (error) {
      if (isSubscriptionExpired(error as any)) {
        console.log(`Subscription expired for ${npub}, removing...`);
        await db.removeSubscription(npub);
        nostrListener.unsubscribeUser(npub);
        activeSubscriptions.delete(npub);
      } else {
        throw error;
      }
    }

    // Update last check timestamp
    const lastCheck = Math.floor(Date.now() / 1000);
    await db.updateLastCheck(npub, lastCheck);
    nostrListener.updateLastCheck(npub, lastCheck);
  } catch (error) {
    console.error("Error handling message:", error);
  }
}

// Load existing subscriptions on startup
async function loadExistingSubscriptions(): Promise<void> {
  const subscriptions = await db.getAllSubscriptions();
  for (const sub of subscriptions) {
    nostrListener.subscribeToUser(sub, handleNewMessage);
    activeSubscriptions.set(sub.npub, sub);
  }
  console.log(`Loaded ${subscriptions.length} existing subscriptions`);
}

// Start server
app.listen(PORT, () => {
  console.log(`Linky notification server running on port ${PORT}`);
  loadExistingSubscriptions();
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  nostrListener.close();
  await db.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  nostrListener.close();
  await db.close();
  process.exit(0);
});
