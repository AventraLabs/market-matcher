import "server-only";
import { and, count, eq, inArray, lte, or } from "drizzle-orm";
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

/**
 * Phase 12: the tally as it stood at a fixed point in time — used to freeze
 * a battle's "official" result at votingEndsAt even though voting itself
 * never actually stops (see castVoteForUser: there's no deadline check).
 * That's deliberate — the master prompt's own idea of a real underdog story
 * playing out over time only works if people can keep voting after the
 * announced result, and the feed shows both: the frozen official result
 * (this function) and the live, still-growing tally (getVoteTally above).
 */
export async function getVoteTallyAsOf(
  battleId: string,
  brandAId: string,
  brandBId: string,
  asOf: Date,
): Promise<VoteTally> {
  const rows = await db
    .select({ votedForBrandId: votes.votedForBrandId, n: count() })
    .from(votes)
    .where(and(eq(votes.battleId, battleId), lte(votes.createdAt, asOf)))
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
 *
 * Deliberately no "voting is closed" check: a Pitch's official result
 * freezes at votingEndsAt (see getVoteTallyAsOf), but anyone who hasn't
 * voted yet can still vote afterwards — the live tally keeps growing, shown
 * in the feed alongside the frozen result. Whether the two ever diverge
 * enough to flip who "would" be winning is exactly the kind of thing worth
 * watching play out, not something to shut off at the deadline.
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
