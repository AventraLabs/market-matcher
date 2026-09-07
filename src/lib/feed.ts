import "server-only";
import { after } from "next/server";
import { getAllBattles, resolveBattleVideos } from "@/lib/battle";
import { getBattleStage } from "@/lib/battle-stage";
import { getVoteTally, getVoteTallyAsOf, getUserVote, type VoteTally } from "@/lib/vote";
import { getLikeCounts, getUserLikedKeys } from "@/lib/like";
import { getCommentCounts } from "@/lib/comment";
import { getFollowedBrandIds } from "@/lib/follow";
import { getBrandForUser } from "@/lib/brand";
import { VOTING_WINDOW_MS } from "@/lib/battle-format";
import { finalizeAndNotifyBattle } from "@/lib/battle-notify";

// Phase 9.1 — one feed entry per Duell (battle), not per side.
//
// Phase 9 originally split a battle into two independent feed cards, one
// per video. Product feedback: that breaks the actual point of a Duell —
// a viewer could scroll past brand A's video and never see brand B's, so
// "vote on this" never really happens. A feed entry now IS the Duell:
// `sides[0]`/`sides[1]` (always brandA/brandB, matching tally.brandAVotes/
// brandBVotes) are both loaded, and the client shows exactly one full-
// screen video at a time — same "one video on screen" feel — but lets the
// viewer flip to the other side without leaving this feed position
// (FeedDuelCard's left/right tap zones). Still nothing pre-reveal ever
// shows up: a card only exists once both sides of its battle are visible
// under the existing Phase 7 "hidden results" rule.
export type FeedDuelSide = {
  brandId: string;
  brandName: string;
  brandSlug: string;
  brandLogoUrl: string | null;
  videoUrl: string;
  likeCount: number;
  viewerLiked: boolean;
  /** Hide the follow button on your own brand's side. */
  viewerOwnsThisBrand: boolean;
  viewerFollowsBrand: boolean;
};

export type FeedDuel = {
  key: string; // battleId — stable across re-fetches
  battleId: string;
  category: string;
  isFinished: boolean;
  votingEndsAt: string | null; // ISO
  revealSplit: boolean;
  /** Live, ever-growing tally — includes votes cast after votingEndsAt too. Drives the running "N Stimmen bisher" count and trending score. */
  tally: VoteTally;
  /**
   * Phase 12: the tally as it stood at votingEndsAt — this is the "official"
   * result once a Pitch is finished, and it never changes afterwards. Null
   * until the Pitch is actually finished. Compare against `tally` to see
   * whether later votes have since shifted the lead.
   */
  officialTally: VoteTally | null;
  commentCount: number;
  viewerVotedBrandId: string | null;
  /** Viewer's own brand is either side of this Duell — can't vote, no follow button on either side. */
  viewerOwnsThisBattle: boolean;
  activatedAt: string; // ISO — when both sides went live, used for recency
  sides: [FeedDuelSide, FeedDuelSide];
  /** Which side to open on — the viewer's followed brand if there is one, otherwise brand A. */
  initialSideIndex: 0 | 1;
};

async function buildFeedDuels(viewerId: string | null): Promise<FeedDuel[]> {
  const allBattles = await getAllBattles();
  const eligible = allBattles.filter((battle) => {
    const { videoUrlA, videoUrlB } = resolveBattleVideos(battle);
    const stage = getBattleStage({
      brandAId: battle.brandAId,
      brandBId: battle.brandBId,
      hasVideoA: Boolean(videoUrlA),
      hasVideoB: Boolean(videoUrlB),
      productionDeadline: battle.productionDeadline,
      votingEndsAt: battle.votingEndsAt,
    });
    // Only a battle where both real videos are visible belongs in the feed
    // — 'awaiting_videos' is still hidden, and a walkover/no_show never got
    // a second video to show at all.
    return stage.stage === "voting" || (stage.stage === "finished" && stage.resolution === "voted");
  });

  if (eligible.length === 0) return [];

  const battleIds = eligible.map((b) => b.id);
  const likeKeys = eligible.flatMap((b) => [
    { battleId: b.id, brandId: b.brandAId },
    { battleId: b.id, brandId: b.brandBId },
  ]);

  const [tallies, officialTallies, commentCounts, likeCounts, viewerLikedKeys, viewerVotes, viewerBrand, followedBrandIds] =
    await Promise.all([
      Promise.all(eligible.map((b) => getVoteTally(b.id, b.brandAId, b.brandBId))),
      // Phase 12: the frozen result at votingEndsAt — null for a battle
      // that's still in its voting window (nothing to freeze yet).
      Promise.all(
        eligible.map((b) =>
          b.votingEndsAt && b.votingEndsAt.getTime() < Date.now()
            ? getVoteTallyAsOf(b.id, b.brandAId, b.brandBId, b.votingEndsAt)
            : Promise.resolve(null),
        ),
      ),
      getCommentCounts(battleIds),
      getLikeCounts(likeKeys),
      viewerId ? getUserLikedKeys(viewerId, likeKeys) : Promise.resolve(new Set<string>()),
      viewerId ? Promise.all(eligible.map((b) => getUserVote(b.id, viewerId))) : Promise.resolve([]),
      viewerId ? getBrandForUser(viewerId) : Promise.resolve(null),
      viewerId ? getFollowedBrandIds(viewerId) : Promise.resolve([]),
    ]);

  const talliesByBattle = new Map(eligible.map((b, i) => [b.id, tallies[i]]));
  const officialTalliesByBattle = new Map(eligible.map((b, i) => [b.id, officialTallies[i]]));
  const viewerVoteByBattle = new Map(eligible.map((b, i) => [b.id, viewerVotes[i] ?? null]));
  const followedSet = new Set(followedBrandIds);

  const duels: FeedDuel[] = [];
  for (const battle of eligible) {
    const { videoUrlA, videoUrlB } = resolveBattleVideos(battle);
    if (!videoUrlA || !videoUrlB) continue; // guaranteed by the eligibility filter, kept for type-narrowing
    const tally = talliesByBattle.get(battle.id)!;
    const officialTally = officialTalliesByBattle.get(battle.id) ?? null;
    // The winner is decided from the frozen result, not the live one —
    // votes cast after votingEndsAt count towards `tally` (shown as "the
    // current trend") but must never flip who officially won.
    const stage = getBattleStage(
      {
        brandAId: battle.brandAId,
        brandBId: battle.brandBId,
        hasVideoA: true,
        hasVideoB: true,
        productionDeadline: battle.productionDeadline,
        votingEndsAt: battle.votingEndsAt,
      },
      officialTally ?? tally,
    );
    const isFinished = stage.stage === "finished";
    if (isFinished && !battle.resultNotifiedAt) {
      // Fire-and-forget, scheduled to run after this response is sent
      // (next/server's after()) — see battle-notify.ts for why this piggy-
      // backs on ordinary feed reads instead of a cron job. Guarded by
      // resultNotifiedAt so this only actually does work once per battle.
      after(() => finalizeAndNotifyBattle(battle.id).catch((err) => console.error("[battle-notify]", err)));
    }
    const activatedAt = battle.votingEndsAt
      ? new Date(battle.votingEndsAt.getTime() - VOTING_WINDOW_MS)
      : battle.createdAt;
    const commentCount = commentCounts.get(battle.id) ?? 0;
    const viewerVotedBrandId = viewerVoteByBattle.get(battle.id) ?? null;
    const viewerOwnsThisBattle = Boolean(
      viewerBrand && (viewerBrand.id === battle.brandAId || viewerBrand.id === battle.brandBId),
    );

    const rawSides: [typeof battle.brandA, typeof battle.brandB] = [battle.brandA, battle.brandB];
    const videoUrls = [videoUrlA, videoUrlB];
    const sides = rawSides.map((brand, i): FeedDuelSide => {
      const key = `${battle.id}:${brand.id}`;
      return {
        brandId: brand.id,
        brandName: brand.name,
        brandSlug: brand.slug,
        brandLogoUrl: brand.logoUrl,
        videoUrl: videoUrls[i]!,
        likeCount: likeCounts.get(key) ?? 0,
        viewerLiked: viewerLikedKeys.has(key),
        viewerOwnsThisBrand: viewerBrand?.id === brand.id,
        viewerFollowsBrand: followedSet.has(brand.id),
      };
    }) as [FeedDuelSide, FeedDuelSide];

    const initialSideIndex: 0 | 1 = followedSet.has(sides[1].brandId) && !followedSet.has(sides[0].brandId) ? 1 : 0;

    duels.push({
      key: battle.id,
      battleId: battle.id,
      category: battle.category,
      isFinished,
      votingEndsAt: battle.votingEndsAt ? battle.votingEndsAt.toISOString() : null,
      revealSplit: isFinished,
      tally,
      officialTally,
      commentCount,
      viewerVotedBrandId,
      viewerOwnsThisBattle,
      activatedAt: activatedAt.toISOString(),
      sides,
      initialSideIndex,
    });
  }
  return duels;
}

/**
 * Live-computed, not stored — same philosophy as effectiveStatus()/
 * getBattleStage(): recompute from current counts every time rather than
 * maintain a cached rank that can drift. Small platform, small dataset,
 * this is cheap; a future phase can cache it once that stops being true.
 */
function trendingScore(duel: FeedDuel): number {
  const ageHours = Math.max(0, (Date.now() - new Date(duel.activatedAt).getTime()) / (60 * 60 * 1000));
  const totalLikes = duel.sides[0].likeCount + duel.sides[1].likeCount;
  const engagement = totalLikes * 1 + duel.commentCount * 1.5 + duel.tally.total * 2;
  // +1/+2 keep a brand-new, zero-engagement Duell from scoring exactly 0
  // (so it still surfaces, just low) and from dividing by a near-zero age.
  return (engagement + 1) / Math.pow(ageHours + 2, 1.3);
}

export type FeedPage = { items: FeedDuel[]; total: number };

/** "Feed" — every live/finished Duell, ranked by a live trending score. */
export async function getForYouFeed(viewerId: string | null, offset = 0, limit = 6): Promise<FeedPage> {
  const duels = await buildFeedDuels(viewerId);
  duels.sort((a, b) => trendingScore(b) - trendingScore(a));
  return { items: duels.slice(offset, offset + limit), total: duels.length };
}

/**
 * One specific Duell by battleId, for deep-linking into the Feed (e.g. from
 * a notification, or a reminder that just went live) — reuses the same
 * eligibility rule as the rest of the feed, so it returns null for anything
 * not actually live/finished-and-voted yet.
 */
export async function getFeedDuelById(viewerId: string | null, battleId: string): Promise<FeedDuel | null> {
  const duels = await buildFeedDuels(viewerId);
  return duels.find((d) => d.battleId === battleId) ?? null;
}

/** "Folge ich" — only Duelle where a followed brand is on one of the two sides, newest first. */
export async function getFollowingFeed(viewerId: string, offset = 0, limit = 6): Promise<FeedPage> {
  const followedBrandIds = await getFollowedBrandIds(viewerId);
  if (followedBrandIds.length === 0) return { items: [], total: 0 };
  const followedSet = new Set(followedBrandIds);
  const duels = (await buildFeedDuels(viewerId)).filter(
    (duel) => followedSet.has(duel.sides[0].brandId) || followedSet.has(duel.sides[1].brandId),
  );
  duels.sort((a, b) => new Date(b.activatedAt).getTime() - new Date(a.activatedAt).getTime());
  return { items: duels.slice(offset, offset + limit), total: duels.length };
}
