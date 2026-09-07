"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedDuel, FeedPage } from "@/lib/feed";
import { FeedDuelCard } from "@/components/feed/feed-duel-card";
import { CommentSheet } from "@/components/feed/comment-sheet";

type Tab = "foryou" | "following";

export function FeedClient({
  initialItems,
  initialTotal,
  isLoggedIn,
}: {
  initialItems: FeedDuel[];
  initialTotal: number;
  isLoggedIn: boolean;
}) {
  const [tab, setTab] = useState<Tab>("foryou");
  const [items, setItems] = useState<FeedDuel[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [muted, setMuted] = useState(true);
  const [commentSheetBattleId, setCommentSheetBattleId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadTab = useCallback(async (nextTab: Tab) => {
    setLoading(true);
    setRequiresLogin(false);
    try {
      const res = await fetch(`/api/feed?tab=${nextTab}&offset=0`);
      const data: FeedPage & { requiresLogin?: boolean } = await res.json();
      setItems(data.items);
      setTotal(data.total);
      setRequiresLogin(Boolean(data.requiresLogin));
    } finally {
      setLoading(false);
    }
  }, []);

  function handleTabChange(nextTab: Tab) {
    if (nextTab === tab) return;
    setTab(nextTab);
    loadTab(nextTab);
  }

  const loadMore = useCallback(async () => {
    if (loadingRef.current || items.length >= total) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/feed?tab=${tab}&offset=${items.length}`);
      const data: FeedPage = await res.json();
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.key));
        return [...prev, ...data.items.filter((i) => !seen.has(i.key))];
      });
      setTotal(data.total);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [tab, items.length, total]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200% 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  function patchDuel(key: string, patch: Partial<FeedDuel>) {
    setItems((prev) => prev.map((duel) => (duel.key === key ? { ...duel, ...patch } : duel)));
  }

  function patchSide(key: string, sideIndex: 0 | 1, patch: Partial<FeedDuel["sides"][number]>) {
    setItems((prev) =>
      prev.map((duel) => {
        if (duel.key !== key) return duel;
        const sides = [...duel.sides] as FeedDuel["sides"];
        sides[sideIndex] = { ...sides[sideIndex], ...patch };
        return { ...duel, sides };
      }),
    );
  }

  async function handleToggleLike(duel: FeedDuel, sideIndex: 0 | 1) {
    const side = duel.sides[sideIndex];
    // Optimistic update — a heart-tap should feel instant.
    patchSide(duel.key, sideIndex, { viewerLiked: !side.viewerLiked, likeCount: side.likeCount + (side.viewerLiked ? -1 : 1) });
    try {
      const res = await fetch("/api/feed/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ battleId: duel.battleId, brandId: side.brandId }),
      });
      const data = await res.json();
      if (res.ok) {
        patchSide(duel.key, sideIndex, { viewerLiked: data.liked, likeCount: data.count });
      } else {
        // Roll back on failure (e.g. session expired mid-scroll).
        patchSide(duel.key, sideIndex, { viewerLiked: side.viewerLiked, likeCount: side.likeCount });
      }
    } catch {
      patchSide(duel.key, sideIndex, { viewerLiked: side.viewerLiked, likeCount: side.likeCount });
    }
  }

  async function handleVote(duel: FeedDuel, sideIndex: 0 | 1) {
    const side = duel.sides[sideIndex];
    try {
      const res = await fetch("/api/feed/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ battleId: duel.battleId, votedForBrandId: side.brandId }),
      });
      const data = await res.json();
      if (res.ok && data.tally) {
        patchDuel(duel.key, { tally: data.tally, viewerVotedBrandId: data.votedForBrandId });
      }
    } catch {
      // Silent — the button just stays clickable, no state changed.
    }
  }

  function handleShare(duel: FeedDuel) {
    const url = `${window.location.origin}/pitches/${duel.battleId}`;
    const shareData = { title: `${duel.sides[0].brandName} vs. ${duel.sides[1].brandName} auf Market Matcher`, url };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  function handleCommentPosted(battleId: string) {
    setItems((prev) =>
      prev.map((duel) => (duel.battleId === battleId ? { ...duel, commentCount: duel.commentCount + 1 } : duel)),
    );
  }

  const showEmptyFollowing = tab === "following" && !loading && items.length === 0;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      {/* Tabs */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center gap-6 pt-[calc(env(safe-area-inset-top)+14px)]">
        {(
          [
            ["foryou", "Feed"],
            ["following", "Folge ich"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`pointer-events-auto text-sm font-semibold drop-shadow ${
              tab === key ? "text-white" : "text-white/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="h-full w-full snap-y snap-mandatory overflow-y-scroll">
        {items.map((duel) => (
          <FeedDuelCard
            key={duel.key}
            duel={duel}
            isLoggedIn={isLoggedIn}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onToggleLike={handleToggleLike}
            onVote={handleVote}
            onOpenComments={setCommentSheetBattleId}
            onShare={handleShare}
          />
        ))}
        <div ref={sentinelRef} className="h-1 w-full" />

        {items.length === 0 && !loading && !showEmptyFollowing && (
          <div className="flex h-dvh w-full flex-col items-center justify-center px-8 text-center">
            <p className="text-lg font-semibold text-white">Noch keine Pitches</p>
            <p className="mt-2 text-sm text-zinc-400">
              Sobald beide Seiten eines Pitches live sind, tauchen sie hier auf.
            </p>
          </div>
        )}

        {showEmptyFollowing && (
          <div className="flex h-dvh w-full flex-col items-center justify-center px-8 text-center">
            <p className="text-lg font-semibold text-white">
              {requiresLogin ? "Melde dich an" : "Folge ein paar Marken"}
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              {requiresLogin
                ? "Melde dich an, um zu sehen, wenn Marken, denen du folgst, einen neuen Pitch posten."
                : "Sobald du Marken folgst, siehst du hier ihre neuesten Pitches zuerst."}
            </p>
            <a
              href={requiresLogin ? "/login" : "/brands"}
              className="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500"
            >
              {requiresLogin ? "Anmelden" : "Marken entdecken"}
            </a>
          </div>
        )}
      </div>

      {commentSheetBattleId && (
        <CommentSheet
          battleId={commentSheetBattleId}
          isLoggedIn={isLoggedIn}
          onClose={() => setCommentSheetBattleId(null)}
          onCommentPosted={handleCommentPosted}
        />
      )}
    </div>
  );
}
