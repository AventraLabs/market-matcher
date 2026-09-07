import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { likes } from "@/db/schema";

export type LikeKey = { battleId: string; brandId: string };

function keyOf(battleId: string, brandId: string): string {
  return `${battleId}:${brandId}`;
}

/** Like counts for a batch of (battleId, brandId) cards — one query for a whole feed page. */
export async function getLikeCounts(keys: LikeKey[]): Promise<Map<string, number>> {
  if (keys.length === 0) return new Map();
  const battleIds = [...new Set(keys.map((k) => k.battleId))];
  const rows = await db
    .select({ battleId: likes.battleId, brandId: likes.brandId, n: count() })
    .from(likes)
    .where(inArray(likes.battleId, battleIds))
    .groupBy(likes.battleId, likes.brandId);
  const map = new Map<string, number>();
  for (const row of rows) map.set(keyOf(row.battleId, row.brandId), row.n);
  return map;
}

/** Which of these cards this user has already liked. */
export async function getUserLikedKeys(userId: string, keys: LikeKey[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const battleIds = [...new Set(keys.map((k) => k.battleId))];
  const rows = await db
    .select({ battleId: likes.battleId, brandId: likes.brandId })
    .from(likes)
    .where(and(eq(likes.userId, userId), inArray(likes.battleId, battleIds)));
  return new Set(rows.map((row) => keyOf(row.battleId, row.brandId)));
}

export async function getLikeCount(battleId: string, brandId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(likes)
    .where(and(eq(likes.battleId, battleId), eq(likes.brandId, brandId)));
  return row?.n ?? 0;
}

/** Toggle a like on/off for this user on this card. */
export async function toggleLikeForUser(
  userId: string,
  battleId: string,
  brandId: string,
): Promise<{ liked: boolean }> {
  const [existing] = await db
    .select({ id: likes.id })
    .from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.battleId, battleId), eq(likes.brandId, brandId)))
    .limit(1);

  if (existing) {
    await db.delete(likes).where(eq(likes.id, existing.id));
    return { liked: false };
  }
  // onConflictDoNothing: a double-tap racing two requests shouldn't 500 or
  // double-insert — the unique index is the real backstop.
  await db.insert(likes).values({ battleId, brandId, userId }).onConflictDoNothing();
  return { liked: true };
}
