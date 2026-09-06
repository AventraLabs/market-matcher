import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { VideoPlayer } from "@/components/brand/video-player";

const COUNTRY_LABELS: Record<string, string> = {
  AT: "Österreich",
  DE: "Deutschland",
  CH: "Schweiz",
  Other: "Andere",
};

export default async function BrandProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [brand] = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);

  if (!brand) notFound();

  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
        <div className="flex items-center gap-4">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, arbitrary source
            <img src={brand.logoUrl} alt={brand.name} className="h-20 w-20 rounded-xl object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-zinc-800 text-3xl font-bold text-zinc-500">
              {brand.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{brand.name}</h1>
            <div className="mt-1 flex gap-2 text-xs">
              <span className="rounded-full bg-orange-500/10 px-2 py-0.5 font-medium text-orange-400">
                {brand.category}
              </span>
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-medium text-zinc-400">
                {COUNTRY_LABELS[brand.country] ?? brand.country}
              </span>
            </div>
          </div>
        </div>

        {brand.description && <p className="mt-6 text-sm leading-relaxed text-zinc-300">{brand.description}</p>}

        {brand.website && (
          <a
            href={brand.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block text-sm text-orange-500 hover:underline"
          >
            {brand.website} ↗
          </a>
        )}

        {brand.videoUrl && (
          <div className="mx-auto mt-6 max-w-[280px]">
            <VideoPlayer src={brand.videoUrl} />
          </div>
        )}
      </div>
    </div>
  );
}
