import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { votes } from "@/db/schema";

export type VoteTally = { brandAVotes: number; brandBVotes: number; total: number };

export async function getVoteTally(battleId: string, brandAId: string, brandBId: string): Promise<VoteTally> {
  const rows = await db
    .select({ votedForBrandId: votes.votedForBrandId, n: count() })
    .from(votes)
    .where(eq(votes.battleId, battleId))
    .groupBy(votes.votedForBrandId);
  const byBrand = new Map(rows.map((r) => [r.votedForBrandId, r.n]));
  const brandAVotes = byBrand.get(brandAId) ?? 0;
  const brandBVotes = byBrand.get(brandBId) ?? 0;
  return { brandAVotes, brandBVotes, total: brandAVotes + brandBVotes };
}

/** Which brand (if any) this user already voted for in this battle. */
export async function getUserVote(battleId: string, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ votedForBrandId: votes.votedForBrandId })
    .from(votes)
    .where(and(eq(votes.battleId, battleId), eq(votes.userId, userId)))
    .limit(1);
  return row?.votedForBrandId ?? null;
}

/** Total vote count per battle, for list views (e.g. /pitches cards). */
export async function getVoteTotals(battleIds: string[]): Promise<Map<string, number>> {
  if (battleIds.length === 0) return new Map();
  const rows = await db
    .select({ battleId: votes.battleId, n: count() })
    .from(votes)
    .where(inArray(votes.battleId, battleIds))
    .groupBy(votes.battleId);
  return new Map(rows.map((r) => [r.battleId, r.n]));
}
