import "server-only";
import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { battles, brands, challenges, type Challenge } from "@/db/schema";

// 2 weeks to accept/decline. Originally 24h, extended per product feedback:
// no brand can turn around a real marketing video in a day, and a brand
// getting challenged by several others at once needs even more room, not
// less. 2 weeks is a starting assumption, not a measured number — easy to
// tune later since it's just this one constant.
export const CHALLENGE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * The status a challenge actually has right now, factoring in the
 * CHALLENGE_WINDOW_MS window. We don't run a cron job to flip stale rows
 * to 'expired' — a challenge nobody looked at for weeks should still
 * correctly read as expired the first time anyone does look, so this is
 * computed, not stored (respondToChallenge additionally persists 'expired'
 * the moment someone tries to act on a stale one, mostly so list views
 * don't have to repeat this logic — but the computed value is always the
 * source of truth).
 */
export function effectiveStatus(challenge: Pick<Challenge, "status" | "expiresAt">): string {
  if (challenge.status === "pending" && challenge.expiresAt.getTime() < Date.now()) {
    return "expired";
  }
  return challenge.status;
}

export type ChallengeWithBrand = Challenge & {
  otherBrand: { id: string; name: string; slug: string; logoUrl: string | null };
  battleId: string | null;
};

/** Challenges sent TO this brand (it's the one deciding). */
export async function getIncomingChallenges(brandId: string): Promise<ChallengeWithBrand[]> {
  const rows = await db
    .select({
      challenge: challenges,
      otherBrand: { id: brands.id, name: brands.name, slug: brands.slug, logoUrl: brands.logoUrl },
      battleId: battles.id,
    })
    .from(challenges)
    .innerJoin(brands, eq(challenges.challengerBrandId, brands.id))
    .leftJoin(battles, eq(battles.challengeId, challenges.id))
    .where(eq(challenges.challengedBrandId, brandId))
    .orderBy(desc(challenges.createdAt));
  return rows.map((r) => ({ ...r.challenge, otherBrand: r.otherBrand, battleId: r.battleId }));
}

/** Challenges this brand sent out. */
export async function getOutgoingChallenges(brandId: string): Promise<ChallengeWithBrand[]> {
  const rows = await db
    .select({
      challenge: challenges,
      otherBrand: { id: brands.id, name: brands.name, slug: brands.slug, logoUrl: brands.logoUrl },
      battleId: battles.id,
    })
    .from(challenges)
    .innerJoin(brands, eq(challenges.challengedBrandId, brands.id))
    .leftJoin(battles, eq(battles.challengeId, challenges.id))
    .where(eq(challenges.challengerBrandId, brandId))
    .orderBy(desc(challenges.createdAt));
  return rows.map((r) => ({ ...r.challenge, otherBrand: r.otherBrand, battleId: r.battleId }));
}

/**
 * Is there already a live (pending, unexpired) challenge between these two
 * brands, in either direction? Used to grey out the "Herausfordern" button
 * and to stop someone from firing off duplicate challenges.
 */
export async function getLivePendingChallengeBetween(brandAId: string, brandBId: string) {
  const rows = await db
    .select()
    .from(challenges)
    .where(
      and(
        eq(challenges.status, "pending"),
        or(
          and(eq(challenges.challengerBrandId, brandAId), eq(challenges.challengedBrandId, brandBId)),
          and(eq(challenges.challengerBrandId, brandBId), eq(challenges.challengedBrandId, brandAId)),
        ),
      ),
    );
  return rows.find((c) => effectiveStatus(c) === "pending") ?? null;
}
