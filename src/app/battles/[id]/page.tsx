import Link from "next/link";
import { notFound } from "next/navigation";
import { getBattleById } from "@/lib/battle";
import { VideoPlayer } from "@/components/brand/video-player";

function BrandSide({ brand }: { brand: { name: string; slug: string; logoUrl: string | null; videoUrl: string | null } }) {
  return (
    <div className="flex-1">
      <Link href={`/brands/${brand.slug}`} className="mb-3 flex items-center gap-2 hover:opacity-80">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, arbitrary source
          <img src={brand.logoUrl} alt={brand.name} className="h-10 w-10 rounded-lg object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-lg font-bold text-zinc-500">
            {brand.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="font-semibold text-white">{brand.name}</span>
      </Link>
      {brand.videoUrl ? (
        <VideoPlayer src={brand.videoUrl} />
      ) : (
        <div className="flex aspect-[9/16] w-full items-center justify-center rounded-xl border border-dashed border-zinc-800 text-center text-sm text-zinc-600">
          Noch kein Video hochgeladen
        </div>
      )}
    </div>
  );
}

export default async function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const battle = await getBattleById(id);
  if (!battle) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-white">
          {battle.brandA.name} <span className="text-orange-500">vs</span> {battle.brandB.name}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">Voting startet in Phase 6 — hier seht ihr schon mal beide Seiten.</p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <BrandSide brand={battle.brandA} />
        <BrandSide brand={battle.brandB} />
      </div>
    </div>
  );
}
