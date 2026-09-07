"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FollowButton } from "@/components/brand/follow-button";
import type { FeedItem } from "@/lib/feed";

function timeLeftLabel(iso: string): string {
  const hoursLeft = Math.max(0, (new Date(iso).getTime() - Date.now()) / (60 * 60 * 1000));
  if (hoursLeft >= 24) return `${Math.ceil(hoursLeft / 24)} Tage`;
  return `${Math.max(1, Math.ceil(hoursLeft))}h`;
}

function VoteState({
  item,
  isLoggedIn,
  onVote,
  voting,
}: {
  item: FeedItem;
  isLoggedIn: boolean;
  onVote: () => void;
  voting: boolean;
}) {
  const { tally, isFinished, revealSplit, viewerVotedBrandId, viewerOwnsThisBattle } = item;

  if (viewerOwnsThisBattle) {
    return <p className="text-xs text-zinc-400">Das ist dein eigener Pitch</p>;
  }

  if (isFinished && revealSplit) {
    const selfVotes = item.isBrandA ? tally.brandAVotes : tally.brandBVotes;
    const pct = tally.total === 0 ? 0 : Math.round((selfVotes / tally.total) * 100);
    const outcome =
      tally.total === 0
        ? null
        : tally.brandAVotes === tally.brandBVotes
          ? "Unentschieden"
          : (item.isBrandA && tally.brandAVotes > tally.brandBVotes) ||
              (!item.isBrandA && tally.brandBVotes > tally.brandAVotes)
            ? "🏆 Gewonnen"
            : "Verloren";
    return (
      <p className="text-xs text-zinc-300">
        {outcome && <span className="font-semibold text-orange-400">{outcome} · </span>}
        {pct}% ({tally.total} {tally.total === 1 ? "Stimme" : "Stimmen"})
      </p>
    );
  }

  if (!isLoggedIn) {
    return (
      <a href="/login" className="text-xs text-orange-400 hover:underline">
        Anmelden, um abzustimmen
      </a>
    );
  }

  if (viewerVotedBrandId) {
    const votedForThis = viewerVotedBrandId === item.brandId;
    return (
      <p className="text-xs text-orange-400">
        {votedForThis ? "✓ Du hast für diese Seite gestimmt" : "✓ Du hast für die Gegenseite gestimmt"}
      </p>
    );
  }

  return (
    <button
      onClick={onVote}
      disabled={voting}
      className="rounded-full bg-orange-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
    >
      {voting ? "…" : `🏆 Für ${item.brandName} stimmen`}
    </button>
  );
}

export function FeedVideoCard({
  item,
  isLoggedIn,
  muted,
  onToggleMute,
  onToggleLike,
  onVote,
  onOpenComments,
  onShare,
}: {
  item: FeedItem;
  isLoggedIn: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onToggleLike: (item: FeedItem) => void;
  onVote: (item: FeedItem) => Promise<void>;
  onOpenComments: (battleId: string) => void;
  onShare: (item: FeedItem) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [voting, setVoting] = useState(false);
  const [shareLabel, setShareLabel] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  async function handleVote() {
    setVoting(true);
    try {
      await onVote(item);
    } finally {
      setVoting(false);
    }
  }

  async function handleShare() {
    onShare(item);
    setShareLabel("Link kopiert!");
    setTimeout(() => setShareLabel(null), 1800);
  }

  const stageLabel = item.isFinished
    ? "Beendet"
    : item.votingEndsAt
      ? `Noch ${timeLeftLabel(item.votingEndsAt)}`
      : "Live";

  return (
    <div ref={containerRef} className="relative h-dvh w-full snap-start snap-always bg-black">
      <video
        ref={videoRef}
        src={item.videoUrl}
        className="h-full w-full object-cover"
        loop
        muted={muted}
        playsInline
        preload="metadata"
        onClick={onToggleMute}
      />

      {/* Mute hint */}
      <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-black/40 px-2 py-1 text-xs text-white">
        {muted ? "🔇" : "🔊"}
      </div>

      {/* Bottom info + vote (extra bottom padding clears the fixed BottomNav) */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 pb-24 pr-20">
        <div className="mb-2 flex items-center gap-2">
          <Link href={`/brands/${item.brandSlug}`} className="text-sm font-bold text-white hover:underline">
            {item.brandName}
          </Link>
          {!item.viewerOwnsThisBrand && isLoggedIn && (
            <FollowButton brandId={item.brandId} isFollowing={item.viewerFollowsBrand} />
          )}
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
            {stageLabel}
          </span>
        </div>
        <p className="mb-2 text-xs text-zinc-300">
          vs.{" "}
          <Link href={`/brands/${item.opponentSlug}`} className="hover:underline">
            {item.opponentName}
          </Link>{" "}
          ·{" "}
          <Link href={`/pitches/${item.battleId}`} className="text-orange-400 hover:underline">
            ganzen Pitch ansehen
          </Link>
        </p>
        <VoteState item={item} isLoggedIn={isLoggedIn} onVote={handleVote} voting={voting} />
      </div>

      {/* Right action rail */}
      <div className="absolute bottom-40 right-3 flex flex-col items-center gap-5">
        <button
          onClick={() => (isLoggedIn ? onToggleLike(item) : (window.location.href = "/login"))}
          className="flex flex-col items-center gap-1"
          aria-label="Like"
        >
          <span className={`text-3xl ${item.viewerLiked ? "" : "opacity-90"}`}>{item.viewerLiked ? "❤️" : "🤍"}</span>
          <span className="text-xs font-medium text-white">{item.likeCount}</span>
        </button>

        <button onClick={() => onOpenComments(item.battleId)} className="flex flex-col items-center gap-1">
          <span className="text-3xl">💬</span>
          <span className="text-xs font-medium text-white">{item.commentCount}</span>
        </button>

        <button onClick={handleShare} className="flex flex-col items-center gap-1">
          <span className="text-3xl">↗️</span>
          <span className="text-xs font-medium text-white">{shareLabel ? "Kopiert" : "Teilen"}</span>
        </button>
      </div>
    </div>
  );
}
