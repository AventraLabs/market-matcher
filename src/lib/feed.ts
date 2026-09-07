import "server-only";
import { getAllBattles, resolveBattleVideos } from "@/lib/battle";
import { getBattleStage } from "@/lib/battle-stage";
import { getVoteTally, getUserVote, type VoteTally } from "@/lib/vote";
import { getLikeCounts, getUserLikedKeys } from "@/lib/like";
import { getCommentCounts } from "@/lib/comment";
import { getFollowedBrandIds } from "@/lib/follow";
import { getBrandForUser } from "@/lib/brand";
import { VOTING_WINDOW_MS } from "@/lib/battle-format";

// Phase 9: the feed. One card per battle *side* — a battle has two videos,
// and "das Video ist der ganze Bildschirm" (one full-screen video per
// swipe) means each side is its own feed item, not the pair. A card only
// exists once its video is actually visible under the existing "hidden
// results" rule (both sides in, so hasVideoA/hasVideoB are guaranteed true
// below) — nothing pre-reveal ever appears in the feed.
export type FeedItem = {
  key: string; // `${battleId}:${brandId}` — stable across re-fetches
  battleId: string;
  brandId: string;
  /** Which side of the underlying battle row this card is — needed to read tally.brandAVotes/brandBVotes correctly. */
  isBrandA: boolean;
  brandName: string;
  brandSlug: string;
  brandLogoUrl: string | null;
  opponentId: string;
  opponentName: string;
  opponentSlug: string;
  videoUrl: string;
  category: string;
  isFinished: boolean;
  votingEndsAt: string | null; // ISO
  revealSplit: boolean;
  tally: VoteTally;
  likeCount: number;
  commentCount: number;
  viewerLiked: boolean;
  viewerVotedBrandId: string | null;
  /** Viewer's own brand is either side of this battle — can't vote, no follow button on either card. */
  viewerOwnsThisBattle: boolean;
  /** Viewer's own brand is specifically *this* card's brand — hide the follow button. */
  viewerOwnsThisBrand: boolean;
  viewerFollowsBrand: boolean;
  activatedAt: string; // ISO — when both sides went live, used for recency
};

async function buildFeedItems(viewerId: string | null): Promise<FeedItem[]> {
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

  const [tallies, commentCounts, likeCounts, viewerLikedKeys, viewerVotes, viewerBrand, followedBrandIds] =
    await Promise.all([
      Promise.all(eligible.map((b) => getVoteTally(b.id, b.brandAId, b.brandBId))),
      getCommentCounts(battleIds),
      getLikeCounts(likeKeys),
      viewerId ? getUserLikedKeys(viewerId, likeKeys) : Promise.resolve(new Set<string>()),
      viewerId ? Promise.all(eligible.map((b) => getUserVote(b.id, viewerId))) : Promise.resolve([]),
      viewerId ? getBrandForUser(viewerId) : Promise.resolve(null),
      viewerId ? getFollowedBrandIds(viewerId) : Promise.resolve([]),
    ]);

  const talliesByBattle = new Map(eligible.map((b, i) => [b.id, tallies[i]]));
  const viewerVoteByBattle = new Map(eligible.map((b, i) => [b.id, viewerVotes[i] ?? null]));
  const followedSet = new Set(followedBrandIds);

  const items: FeedItem[] = [];
  for (const battle of eligible) {
    const { videoUrlA, videoUrlB } = resolveBattleVideos(battle);
    const tally = talliesByBattle.get(battle.id)!;
    const stage = getBattleStage(
      {
        brandAId: battle.brandAId,
        brandBId: battle.brandBId,
        hasVideoA: true,
        hasVideoB: true,
        productionDeadline: battle.productionDeadline,
        votingEndsAt: battle.votingEndsAt,
      },
      tally,
    );
    const isFinished = stage.stage === "finished";
    const activatedAt = battle.votingEndsAt
      ? new Date(battle.votingEndsAt.getTime() - VOTING_WINDOW_MS)
      : battle.createdAt;
    const commentCount = commentCounts.get(battle.id) ?? 0;
    const viewerVotedBrandId = viewerVoteByBattle.get(battle.id) ?? null;
    const viewerOwnsThisBattle = Boolean(
      viewerBrand && (viewerBrand.id === battle.brandAId || viewerBrand.id === battle.brandBId),
    );

    const sides = [
      { self: battle.brandA, opponent: battle.brandB, videoUrl: videoUrlA, isBrandA: true },
      { self: battle.brandB, opponent: battle.brandA, videoUrl: videoUrlB, isBrandA: false },
    ];

    for (const side of sides) {
      if (!side.videoUrl) continue;
      const key = `${battle.id}:${side.self.id}`;
      items.push({
        key,
        battleId: battle.id,
        brandId: side.self.id,
        isBrandA: side.isBrandA,
        brandName: side.self.name,
        brandSlug: side.self.slug,
        brandLogoUrl: side.self.logoUrl,
        opponentId: side.opponent.id,
        opponentName: side.opponent.name,
        opponentSlug: side.opponent.slug,
        videoUrl: side.videoUrl,
        category: battle.category,
        isFinished,
        votingEndsAt: battle.votingEndsAt ? battle.votingEndsAt.toISOString() : null,
        revealSplit: isFinished,
        tally,
        likeCount: likeCounts.get(key) ?? 0,
        commentCount,
        viewerLiked: viewerLikedKeys.has(key),
        viewerVotedBrandId,
        viewerOwnsThisBattle,
        viewerOwnsThisBrand: viewerBrand?.id === side.self.id,
        viewerFollowsBrand: followedSet.has(side.self.id),
        activatedAt: activatedAt.toISOString(),
      });
    }
  }
  return items;
}

/**
 * Live-computed, not stored — same philosophy as effectiveStatus()/
 * getBattleStage(): recompute from current counts every time rather than
 * maintain a cached rank that can drift. Small platform, small dataset,
 * this is cheap; a future phase can cache it once that stops being true.
 */
function trendingScore(item: FeedItem): number {
  const ageHours = Math.max(0, (Date.now() - new Date(item.activatedAt).getTime()) / (60 * 60 * 1000));
  const engagement = item.likeCount * 1 + item.commentCount * 1.5 + item.tally.total * 2;
  // +1/+2 keep a brand-new, zero-engagement card from scoring exactly 0 (so
  // it still surfaces, just low) and from dividing by a near-zero age.
  return (engagement + 1) / Math.pow(ageHours + 2, 1.3);
}

export type FeedPage = { items: FeedItem[]; total: number };

/** "Für dich" — every live/finished Pitch, ranked by a live trending score. */
export async function getForYouFeed(viewerId: string | null, offset = 0, limit = 6): Promise<FeedPage> {
  const items = await buildFeedItems(viewerId);
  items.sort((a, b) => trendingScore(b) - trendingScore(a));
  return { items: items.slice(offset, offset + limit), total: items.length };
}

/** "Folge ich" — only cards from brands the viewer follows, newest first. */
export async function getFollowingFeed(viewerId: string, offset = 0, limit = 6): Promise<FeedPage> {
  const items = (await buildFeedItems(viewerId)).filter((item) => item.viewerFollowsBrand);
  items.sort((a, b) => new Date(b.activatedAt).getTime() - new Date(a.activatedAt).getTime());
  return { items: items.slice(offset, offset + limit), total: items.length };
}
