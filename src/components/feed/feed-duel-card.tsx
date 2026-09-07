"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FollowButton } from "@/components/brand/follow-button";
import type { FeedDuel } from "@/lib/feed";

function timeLeftLabel(iso: string): string {
  const hoursLeft = Math.max(0, (new Date(iso).getTime() - Date.now()) / (60 * 60 * 1000));
  if (hoursLeft >= 24) return `${Math.ceil(hoursLeft / 24)} Tage`;
  return `${Math.max(1, Math.ceil(hoursLeft))}h`;
}

function outcomeLabel(sideIndex: 0 | 1, tally: FeedDuel["tally"]): string | null {
  if (tally.total === 0) return null;
  if (tally.brandAVotes === tally.brandBVotes) return "Unentschieden";
  const won = (sideIndex === 0 && tally.brandAVotes > tally.brandBVotes) || (sideIndex === 1 && tally.brandBVotes > tally.brandAVotes);
  return won ? "🏆 Gewonnen" : "Verloren";
}

function ResultLine({ sideIndex, tally, prefix }: { sideIndex: 0 | 1; tally: FeedDuel["tally"]; prefix?: string }) {
  const sideVotes = sideIndex === 0 ? tally.brandAVotes : tally.brandBVotes;
  const pct = tally.total === 0 ? 0 : Math.round((sideVotes / tally.total) * 100);
  const outcome = outcomeLabel(sideIndex, tally);
  return (
    <p className="text-xs text-zinc-300">
      {prefix && <span className="text-zinc-500">{prefix} </span>}
      {outcome && <span className="font-semibold text-orange-400">{outcome} · </span>}
      {pct}% ({tally.total} {tally.total === 1 ? "Stimme" : "Stimmen"})
    </p>
  );
}

// Phase 12: two things were lost when the Feed replaced the old battle-
// detail page as the only place to actually vote, both restored here:
//   1. Before a Pitch is finished, the split never shows — only the running
//      total ("340 Stimmen bisher") — same "don't create a bandwagon effect"
//      reasoning as Phase 7's VotePanel, which this component has fully
//      replaced (that component and its now-orphaned server action were
//      removed in this phase).
//   2. Voting doesn't actually stop once a Pitch is "finished" — the
//      official result freezes at votingEndsAt (`officialTally`), but anyone
//      who hasn't voted yet can still vote afterwards, and `tally` (the
//      live, ever-growing count) is shown alongside the frozen one whenever
//      they've diverged — that's the whole point of not cutting voting off.
function VoteState({
  duel,
  sideIndex,
  isLoggedIn,
  onVote,
  voting,
}: {
  duel: FeedDuel;
  sideIndex: 0 | 1;
  isLoggedIn: boolean;
  onVote: () => void;
  voting: boolean;
}) {
  const { tally, officialTally, isFinished, viewerVotedBrandId, viewerOwnsThisBattle, votingEndsAt } = duel;
  const side = duel.sides[sideIndex];

  if (viewerOwnsThisBattle) {
    return <p className="text-xs text-zinc-400">Das ist dein eigener Pitch</p>;
  }

  if (!isLoggedIn) {
    return (
      <div className="space-y-1">
        {tally.total > 0 && <p className="text-xs text-zinc-500">{tally.total} {tally.total === 1 ? "Stimme" : "Stimmen"} bisher</p>}
        <a href="/login" className="text-xs text-orange-400 hover:underline">
          Anmelden, um abzustimmen
        </a>
      </div>
    );
  }

  const hasDiverged = isFinished && officialTally && tally.total !== officialTally.total;
  const officialResult = isFinished && officialTally ? <ResultLine sideIndex={sideIndex} tally={officialTally} prefix="Ergebnis:" /> : null;
  const liveDrift = hasDiverged ? <ResultLine sideIndex={sideIndex} tally={tally} prefix="🔄 Aktuell:" /> : null;

  if (viewerVotedBrandId) {
    const votedForThis = viewerVotedBrandId === side.brandId;
    return (
      <div className="space-y-1">
        <p className="text-xs text-orange-400">
          {votedForThis ? "✓ Du hast für diese Seite gestimmt" : "✓ Du hast für die Gegenseite gestimmt"}
        </p>
        {officialResult ?? (
          <p className="text-xs text-zinc-500">
            {tally.total} {tally.total === 1 ? "Stimme" : "Stimmen"} bisher — wer führt, bleibt geheim bis Fristende.
          </p>
        )}
        {liveDrift}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {officialResult}
      {liveDrift}
      {isFinished && <p className="text-xs text-zinc-500">Die Frist ist zwar um, du kannst aber trotzdem noch abstimmen:</p>}
      <button
        onClick={onVote}
        disabled={voting}
        className="rounded-full bg-orange-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
      >
        {voting ? "…" : `🏆 Für ${side.brandName} stimmen`}
      </button>
      {!isFinished && (
        <p className="text-xs text-zinc-500">
          {tally.total > 0 ? `${tally.total} ${tally.total === 1 ? "Stimme" : "Stimmen"} bisher · ` : ""}
          wer führt, bleibt geheim bis {votingEndsAt ? new Date(votingEndsAt).toLocaleDateString("de-DE") : "Fristende"}
        </p>
      )}
    </div>
  );
}

export function FeedDuelCard({
  duel,
  isLoggedIn,
  muted,
  onToggleMute,
  onToggleLike,
  onVote,
  onOpenComments,
  onShare,
}: {
  duel: FeedDuel;
  isLoggedIn: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onToggleLike: (duel: FeedDuel, sideIndex: 0 | 1) => void;
  onVote: (duel: FeedDuel, sideIndex: 0 | 1) => Promise<void>;
  onOpenComments: (battleId: string) => void;
  onShare: (duel: FeedDuel) => void;
}) {
  const [sideIndex, setSideIndex] = useState<0 | 1>(duel.initialSideIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null]);
  const [inView, setInView] = useState(false);
  const [voting, setVoting] = useState(false);
  const [shareLabel, setShareLabel] = useState<string | null>(null);

  const side = duel.sides[sideIndex];
  const opponent = duel.sides[sideIndex === 0 ? 1 : 0];

  // Card visibility (scroll-snap) drives whether either video is allowed to play.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setInView(entry.isIntersecting && entry.intersectionRatio >= 0.6);
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Only the active side plays — the other stays mounted (keeps its
  // position/loaded state) but paused, so flipping sides is instant and
  // doesn't restart or reload the video you just came from.
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      video.muted = muted;
      if (inView && i === sideIndex) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [inView, sideIndex, muted]);

  async function handleVote() {
    setVoting(true);
    try {
      await onVote(duel, sideIndex);
    } finally {
      setVoting(false);
    }
  }

  function handleShare() {
    onShare(duel);
    setShareLabel("Link kopiert!");
    setTimeout(() => setShareLabel(null), 1800);
  }

  // Left third / right third = switch to that side, middle = mute toggle —
  // same "tap zones" pattern as a two-panel story, chosen specifically
  // because there are exactly two sides to a Duell (no next/prev list to
  // page through, just "the other one").
  function handleVideoClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;
    if (x < third) setSideIndex(0);
    else if (x > third * 2) setSideIndex(1);
    else onToggleMute();
  }

  const stageLabel = duel.isFinished
    ? "Beendet"
    : duel.votingEndsAt
      ? `Noch ${timeLeftLabel(duel.votingEndsAt)}`
      : "Live";

  return (
    <div
      ref={containerRef}
      data-battle-id={duel.battleId}
      className="relative h-dvh w-full snap-start snap-always bg-black"
    >
      {duel.sides.map((s, i) => (
        <video
          key={s.brandId}
          ref={(el) => {
            videoRefs.current[i] = el;
          }}
          src={s.videoUrl}
          className={`absolute inset-0 h-full w-full object-cover ${i === sideIndex ? "" : "hidden"}`}
          loop
          muted={muted}
          playsInline
          preload="metadata"
        />
      ))}
      <div className="absolute inset-0" onClick={handleVideoClick} />

      {/* Mute hint */}
      <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-black/40 px-2 py-1 text-xs text-white">
        {muted ? "🔇" : "🔊"}
      </div>

      {/* Two-sides indicator + edge chevrons */}
      <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center gap-1.5">
        {([0, 1] as const).map((i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === sideIndex ? "bg-white" : "bg-white/30"}`} />
        ))}
      </div>
      {sideIndex === 1 && (
        <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-2xl text-white/50">‹</div>
      )}
      {sideIndex === 0 && (
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-2xl text-white/50">›</div>
      )}

      {/* Bottom info + vote (extra bottom padding clears the fixed BottomNav) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 pb-24 pr-20">
        <div className="pointer-events-auto mb-2 flex items-center gap-2">
          <Link href={`/brands/${side.brandSlug}`} className="text-sm font-bold text-white hover:underline">
            {side.brandName}
          </Link>
          {!side.viewerOwnsThisBrand && isLoggedIn && (
            <FollowButton brandId={side.brandId} isFollowing={side.viewerFollowsBrand} />
          )}
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
            {stageLabel}
          </span>
        </div>
        <div className="pointer-events-auto mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-300">
          <button
            onClick={() => setSideIndex(sideIndex === 0 ? 1 : 0)}
            className="rounded-full border border-white/20 px-2 py-1 text-orange-300 hover:border-orange-400"
          >
            ↔ Antwort von {opponent.brandName} ansehen
          </button>
        </div>
        <div className="pointer-events-auto">
          <VoteState duel={duel} sideIndex={sideIndex} isLoggedIn={isLoggedIn} onVote={handleVote} voting={voting} />
        </div>
      </div>

      {/* Right action rail */}
      <div className="pointer-events-auto absolute bottom-40 right-3 flex flex-col items-center gap-5">
        <button
          onClick={() => (isLoggedIn ? onToggleLike(duel, sideIndex) : (window.location.href = "/login"))}
          className="flex flex-col items-center gap-1"
          aria-label="Like"
        >
          <span className="text-3xl">{side.viewerLiked ? "❤️" : "🤍"}</span>
          <span className="text-xs font-medium text-white">{side.likeCount}</span>
        </button>

        <button onClick={() => onOpenComments(duel.battleId)} className="flex flex-col items-center gap-1">
          <span className="text-3xl">💬</span>
          <span className="text-xs font-medium text-white">{duel.commentCount}</span>
        </button>

        <button onClick={handleShare} className="flex flex-col items-center gap-1">
          <span className="text-3xl">↗️</span>
          <span className="text-xs font-medium text-white">{shareLabel ? "Kopiert" : "Teilen"}</span>
        </button>
      </div>
    </div>
  );
}
