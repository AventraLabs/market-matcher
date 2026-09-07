import "server-only";
import { and, count, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { battles, brandMembers, votes } from "@/db/schema";

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

/**
 * The actual vote-casting logic, shared by the /pitches/[id] page's form
 * action (src/app/actions/vote.ts) and the feed's vote API route
 * (src/app/api/feed/vote/route.ts) — same rules either way: a brand's own
 * team can't vote in its own Pitch, and one vote per battle per user (the
 * unique index on (battleId, userId) is the real backstop, this check is
 * just for a friendly error message).
 */
export async function castVoteForUser(
  userId: string,
  battleId: string,
  votedForBrandId: string,
): Promise<{ error?: string }> {
  const [battle] = await db.select().from(battles).where(eq(battles.id, battleId)).limit(1);
  if (!battle) {
    return { error: "Dieser Pitch existiert nicht." };
  }
  if (votedForBrandId !== battle.brandAId && votedForBrandId !== battle.brandBId) {
    return { error: "Ungültige Marke für diesen Pitch." };
  }

  const [ownMembership] = await db
    .select({ brandId: brandMembers.brandId })
    .from(brandMembers)
    .where(
      and(
        eq(brandMembers.userId, userId),
        or(eq(brandMembers.brandId, battle.brandAId), eq(brandMembers.brandId, battle.brandBId)),
      ),
    )
    .limit(1);
  if (ownMembership) {
    return { error: "Du kannst nicht bei einem Pitch deiner eigenen Marke abstimmen." };
  }

  const existingVote = await getUserVote(battleId, userId);
  if (existingVote) {
    return { error: "Du hast bereits abgestimmt." };
  }

  await db.insert(votes).values({ battleId, userId, votedForBrandId }).onConflictDoNothing();
  return {};
}
