import { createHash } from "node:crypto";
import webpush from "web-push";
import * as db from "./db";
import { decryptSecret } from "./security";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

function endpointHash(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

async function getVapidConfig() {
  const [publicConfig, privateConfig, subjectConfig] = await Promise.all([
    db.getAppSecretConfig("vapidPublicKey"),
    db.getAppSecretConfig("vapidPrivateKey"),
    db.getAppSecretConfig("vapidSubject"),
  ]);
  if (!publicConfig?.encryptedValue || !privateConfig?.encryptedValue || !subjectConfig?.encryptedValue) return null;
  try {
    return {
      publicKey: decryptSecret(publicConfig.encryptedValue),
      privateKey: decryptSecret(privateConfig.encryptedValue),
      subject: decryptSecret(subjectConfig.encryptedValue),
    };
  } catch {
    return null;
  }
}

export async function saveSubscription(userId: number, subscription: { endpoint: string; keys?: { p256dh?: string; auth?: string } }, userAgent?: string | null) {
  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) throw new Error("Invalid push subscription");
  await db.upsertPushSubscription({ userId, endpoint: subscription.endpoint, endpointHash: endpointHash(subscription.endpoint), p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent: userAgent ?? null });
}

export async function removeSubscription(userId: number, endpoint: string) {
  await db.deletePushSubscription(endpointHash(endpoint), userId);
}

export async function sendPushToUser(userId: number, payload: PushPayload) {
  const vapid = await getVapidConfig();
  if (!vapid) return { sent: 0, skipped: true } as const;
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  const subscriptions = await db.getPushSubscriptionsForUser(userId);
  let sent = 0;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload));
      sent += 1;
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) await db.deletePushSubscription(subscription.endpointHash, userId);
      else console.warn("[Push] Delivery failed", error);
    }
  }
  return { sent, skipped: false } as const;
}
