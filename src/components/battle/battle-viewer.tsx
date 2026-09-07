"use client";

import Link from "next/link";
import { useState } from "react";
import { VideoPlayer } from "@/components/brand/video-player";

type Side = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  videoUrl: string | null;
};

function TabButton({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 truncate px-4 py-3 text-sm font-semibold transition-colors " +
        (isActive ? "bg-orange-600 text-white" : "bg-zinc-950 text-zinc-400 hover:bg-zinc-900")
      }
    >
      {label}
    </button>
  );
}

/**
 * One video at a time, TikTok/Reels-style, instead of two videos squeezed
 * side by side — on a phone, side-by-side left almost nothing visible of
 * either. Tap a brand's name to switch sides; each stays mounted only while
 * active, so switching also pauses the other video.
 */
export function BattleViewer({ brandA, brandB }: { brandA: Side; brandB: Side }) {
  const [active, setActive] = useState<"A" | "B">("A");
  const activeBrand = active === "A" ? brandA : brandB;

  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div className="mb-4 flex overflow-hidden rounded-xl border border-zinc-800">
        <TabButton label={brandA.name} isActive={active === "A"} onClick={() => setActive("A")} />
        <TabButton label={brandB.name} isActive={active === "B"} onClick={() => setActive("B")} />
      </div>

      {activeBrand.videoUrl ? (
        <VideoPlayer key={activeBrand.id} src={activeBrand.videoUrl} />
      ) : (
        <div className="flex aspect-[9/16] w-full items-center justify-center rounded-xl border border-dashed border-zinc-800 text-center text-sm text-zinc-600">
          Noch kein Video hochgeladen
        </div>
      )}

      <Link
        href={`/brands/${activeBrand.slug}`}
        className="mt-3 flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        {activeBrand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, arbitrary source
          <img src={activeBrand.logoUrl} alt={activeBrand.name} className="h-6 w-6 rounded-md object-cover" />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-800 text-xs font-bold text-zinc-500">
            {activeBrand.name.charAt(0).toUpperCase()}
          </div>
        )}
        {activeBrand.name} ansehen →
      </Link>
    </div>
  );
}
