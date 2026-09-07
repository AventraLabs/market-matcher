import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { battles, brands, notifications, type NewNotification } from "@/db/schema";
import { getFollowerUserIds } from "@/lib/follow";
import { VOTING_WINDOW_MS } from "@/lib/battle-format";

export type BattleStage =
  | { stage: "awaiting_videos"; waitingOnBrandIds: string[]; deadline: Date | null }
  | { stage: "voting"; endsAt: Date }
  | { stage: "finished"; resolution: "voted" | "walkover" | "no_show"; winnerBrandId: string | null };

/**
 * The single source of truth for "what state is this battle actually in" —
 * computed from timestamps, not stored, same philosophy as
 * effectiveStatus() for challenges. `hasVideoA`/`hasVideoB` are passed in
 * (rather than read from the battle row directly) so the caller can apply
 * the pre-Phase-7 fallback to a brand's profile video for old rows — see
 * resolveBattleVideos() in src/lib/battle.ts.
 */
export function getBattleStage(
  input: {
    brandAId: string;
    brandBId: string;
    hasVideoA: boolean;
    hasVideoB: boolean;
    productionDeadline: Date | null;
    votingEndsAt: Date | null;
  },
  tally?: { brandAVotes: number; brandBVotes: number },
): BattleStage {
  const now = Date.now();
  const { brandAId, brandBId, hasVideoA, hasVideoB, productionDeadline, votingEndsAt } = input;

  if (!hasVideoA || !hasVideoB) {
    const deadlinePassed = productionDeadline ? productionDeadline.getTime() < now : false;
    if (deadlinePassed) {
      if (hasVideoA && !hasVideoB) return { stage: "finished", resolution: "walkover", winnerBrandId: brandAId };
      if (hasVideoB && !hasVideoA) return { stage: "finished", resolution: "walkover", winnerBrandId: brandBId };
      return { stage: "finished", resolution: "no_show", winnerBrandId: null };
    }
    const waitingOnBrandIds = [!hasVideoA ? brandAId : null, !hasVideoB ? brandBId : null].filter(
      (x): x is string => Boolean(x),
    );
    return { stage: "awaiting_videos", waitingOnBrandIds, deadline: productionDeadline };
  }

  // Both sides are in.
  if (votingEndsAt && votingEndsAt.getTime() < now) {
    const winnerBrandId =
      !tally || tally.brandAVotes === tally.brandBVotes
        ? null
        : tally.brandAVotes > tally.brandBVotes
          ? brandAId
          : brandBId;
    return { stage: "finished", resolution: "voted", winnerBrandId };
  }
  // votingEndsAt should always be set the instant both sides are in (see
  // activateBattleIfBothSidesReady) — this fallback only covers the brief
  // race between the video landing and that write completing.
  return { stage: "voting", endsAt: votingEndsAt ?? new Date(now + VOTING_WINDOW_MS) };
}

/**
 * Call after any battle-video upload (scheduled or open mode). If both
 * sides are now in and voting hasn't been opened yet, opens it (sets
 * votingEndsAt) and fires the "battle is live, vote now" notification to
 * everyone following either brand. For 'open' battles this fires
 * immediately, since both sides are already present at creation.
 */
export async function activateBattleIfBothSidesReady(battleId: string): Promise<void> {
  const [battle] = await db.select().from(battles).where(eq(battles.id, battleId)).limit(1);
  if (!battle) return;
  if (!battle.brandAVideoUrl || !battle.brandBVideoUrl) return;
  if (battle.votingEndsAt) return; // already activated

  await db
    .update(battles)
    .set({ votingEndsAt: new Date(Date.now() + VOTING_WINDOW_MS) })
    .where(eq(battles.id, battleId));

  await notifyFollowersOfLiveBattle(battleId, battle.brandAId, battle.brandBId);
}

async function notifyFollowersOfLiveBattle(battleId: string, brandAId: string, brandBId: string) {
  const [brandARows, brandBRows] = await Promise.all([
    db.select({ name: brands.name }).from(brands).where(eq(brands.id, brandAId)).limit(1),
    db.select({ name: brands.name }).from(brands).where(eq(brands.id, brandBId)).limit(1),
  ]);
  const brandAName = brandARows[0]?.name ?? "Eine Marke";
  const brandBName = brandBRows[0]?.name ?? "eine Marke";

  const [brandAFollowers, brandBFollowers] = await Promise.all([
    getFollowerUserIds(brandAId),
    getFollowerUserIds(brandBId),
  ]);

  const rows: NewNotification[] = [
    ...brandAFollowers.map((userId) => ({
      userId,
      message: `⚔️ ${brandAName} battelt jetzt gegen ${brandBName} — jetzt abstimmen!`,
      battleId,
    })),
    ...brandBFollowers.map((userId) => ({
      userId,
      message: `⚔️ ${brandBName} battelt jetzt gegen ${brandAName} — jetzt abstimmen!`,
      battleId,
    })),
  ];
  if (rows.length > 0) {
    await db.insert(notifications).values(rows);
  }
}
