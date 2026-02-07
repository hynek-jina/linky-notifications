# Linky Notifications

Push notification server for Linky Nostr DMs.

## Architecture

This server provides push notifications for the Linky PWA by:
1. Accepting push subscriptions from Linky clients
2. Maintaining persistent WebSocket connections to Nostr relays
3. Listening for new DM messages (kind 4 and 1059)
4. Sending push notifications via Web Push API

## Prerequisites

- Node.js 18+
- SQLite (included)
- VAPID keys for Web Push

## Setup

### 1. Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

Save the public and private keys.

### 2. Environment Variables

Create `.env` file:

```env
PORT=3000
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
DB_PATH=./data/subscriptions.db
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Build

```bash
npm run build
```

### 5. Run

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

## Deployment on Render

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
DB_PATH=/opt/render/project/src/data/subscriptions.db
```

### 4. Create Disk (for SQLite persistence)

In Render dashboard:
1. Go to "Disks" tab
2. Click "Add Disk"
3. **Name**: `data`
4. **Mount Path**: `/opt/render/project/src/data`
5. **Size**: 1 GB (minimum)

### 5. Deploy

Click "Create Web Service". Render will:
1. Build the TypeScript code
2. Start the server
3. Keep it running 24/7

## Free Tier Limits

Render free tier includes:
- 750 hours/month (enough for 24/7 operation)
- 512 MB RAM
- 1 GB disk (for SQLite)

## Linky Integration

Add this to Linky's `.env`:

```env
VITE_NOTIFICATION_SERVER_URL=https://linky-notifications.onrender.com
```

Or update it in Linky's settings to point to your deployed server.

## License

MIT
