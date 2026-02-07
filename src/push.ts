import webpush from 'web-push';
import type { PushSubscription } from './db.js';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (!vapidPublicKey || !vapidPrivateKey) {
  console.warn('Warning: VAPID keys not configured. Push notifications will not work.');
}

webpush.setVapidDetails(
  'mailto:admin@linky.app',
  vapidPublicKey,
  vapidPrivateKey
);

export interface NotificationPayload {
  title: string;
  body: string;
  data?: {
    type: string;
    contactNpub?: string;
  };
}

export async function sendNotification(
  subscription: PushSubscription,
  payload: NotificationPayload
): Promise<void> {
  const pushPayload = JSON.stringify({
    title: payload.title || 'Nová zpráva',
    body: payload.body || 'Máš novou zprávu v Linky',
    data: payload.data || { type: 'dm' },
  });

  await webpush.sendNotification(subscription, pushPayload);
}

export function isSubscriptionExpired(error: any): boolean {
  return error.statusCode === 404 || error.statusCode === 410;
}
