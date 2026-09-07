import "server-only";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { follows } from "@/db/schema";

export async function isFollowing(userId: string, brandId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.userId, userId), eq(follows.brandId, brandId)))
    .limit(1);
  return Boolean(row);
}

export async function getFollowerCount(brandId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(follows).where(eq(follows.brandId, brandId));
  return row?.n ?? 0;
}

/** Every user following this brand — used to fan out notifications. */
export async function getFollowerUserIds(brandId: string): Promise<string[]> {
  const rows = await db.select({ userId: follows.userId }).from(follows).where(eq(follows.brandId, brandId));
  return rows.map((r) => r.userId);
}
