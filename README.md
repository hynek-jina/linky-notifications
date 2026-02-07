# Linky Notifications

Push notification server for Linky Nostr DMs.

## Architecture

This server provides push notifications for the Linky PWA by:
1. Accepting push subscriptions from Linky clients
2. Maintaining persistent WebSocket connections to Nostr relays
3. Listening for new DM messages (kind 4 and 1059)
4. Sending push notifications via Web Push API

Uses **Turso** (cloud SQLite) for data persistence - no persistent disk required!

## Prerequisites

- Node.js 18+
- Turso account (free tier)
- VAPID keys for Web Push

## Setup

### 1. Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

Save the public and private keys.

### 2. Create Turso Database

1. Sign up at [turso.tech](https://turso.tech)
2. Install Turso CLI:
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```
3. Login and create database:
   ```bash
   turso auth login
   turso db create linky-notifications
   ```
4. Get connection URL and auth token:
   ```bash
   turso db show linky-notifications
   turso db tokens create linky-notifications
   ```

### 3. Environment Variables

Create `.env` file:

```env
PORT=3000
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
TURSO_URL=libsql://your-db-url.turso.io
TURSO_AUTH_TOKEN=your_auth_token_here
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Build

```bash
npm run build
```

### 6. Run

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

## API Endpoints

### Health Check
```
GET /health
```

### Subscribe
```
POST /subscribe
Content-Type: application/json

{
  "npub": "npub1...",
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "expirationTime": null,
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "relays": ["wss://nos.lol", "wss://relay.damus.io"]
}
```

### Unsubscribe
```
POST /unsubscribe
Content-Type: application/json

{
  "npub": "npub1..."
}
```

## Deployment on Render (Free Tier)

### 1. Create Web Service

1. Go to [render.com](https://render.com) dashboard
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Select the `linky-notifications` repo

### 2. Configure Build Settings

- **Name**: `linky-notifications` (or your preferred name)
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

### 3. Environment Variables

Add these in Render dashboard:

```
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your_token
```

### 4. Deploy

Click "Create Web Service". Render will:
1. Build the TypeScript code
2. Start the server
3. Keep it running 24/7

**No disk required!** Data is stored in Turso cloud database.

## Free Tier Limits

**Render** (compute):
- 750 hours/month (enough for 24/7 operation)
- 512 MB RAM

**Turso** (database):
- 500 databases
- 1 GB storage per database
- 1 billion row reads/month
- 10 million row writes/month

Perfect for Linky notifications!

## Linky Integration

Add this to Linky's `.env`:

```env
VITE_NOTIFICATION_SERVER_URL=https://linky-notifications.onrender.com
```

Or update it in Linky's settings to point to your deployed server.

## License

MIT
