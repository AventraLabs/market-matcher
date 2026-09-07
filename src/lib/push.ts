import "server-only";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions, type NewPushSubscription } from "@/db/schema";

// Phase 12: web push. VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are a keypair this
// app generated for itself (npx web-push generate-vapid-keys) — not a
// third-party API key, there's no external account behind them. Both must
// be set in Vercel's environment variables for pushes to actually send in
// prod; locally they come from .env.local like everything else. Deliberately
// fails soft (no-op, not a thrown error) when unset, so the rest of the app
// keeps working before/without that env var being configured.
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:no-reply@market-matcher.app";

const configured = Boolean(PUBLIC_KEY && PRIVATE_KEY);
if (configured) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY!, PRIVATE_KEY!);
}

export function isPushConfigured(): boolean {
  return configured;
}

/** Upsert by endpoint — re-subscribing the same browser replaces its keys instead of duplicating the row. */
export async function saveSubscription(sub: NewPushSubscription): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values(sub)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: sub.userId, p256dh: sub.p256dh, auth: sub.auth },
    });
}

export type PushPayload = { title: string; body: string; url: string };

/**
 * Sends to every subscription this user has (phone + laptop, etc). A 404/410
 * from the push service means the browser unsubscribed or the subscription
 * expired — those rows are cleaned up rather than retried forever.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configured) return;
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        } else {
          console.error(`[push] failed to notify user ${userId}:`, err);
        }
      }
    }),
  );
}
