import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications, type Notification } from "@/db/schema";

const RECENT_LIMIT = 20;

/** Most recent notifications for this user, newest first. */
export async function getNotificationsForUser(userId: string): Promise<Notification[]> {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(RECENT_LIMIT);
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return rows.length;
}
