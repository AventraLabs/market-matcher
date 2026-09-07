import Link from "next/link";
import { getAllBattles } from "@/lib/battle";

// Always live data — without this, Next prerenders it once at build time
// (no dynamic API is used otherwise) and it would never show a battle
// created after the last deploy.
export const dynamic = "force-dynamic";

function BrandThumb({ brand }: { brand: { name: string; logoUrl: string | null } }) {
  return brand.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, arbitrary source
    <img src={brand.logoUrl} alt={brand.name} className="h-12 w-12 rounded-lg object-cover" />
  ) : (
    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800 text-lg font-bold text-zinc-500">
      {brand.name.charAt(0).toUpperCase()}
    </div>
  );
}

export default async function BattlesPage() {
  const battles = await getAllBattles();

  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-white">Battles</h1>

      {battles.length === 0 ? (
        <p className="text-sm text-zinc-500">Noch keine Battles — Herausforderungen annehmen, um eins zu starten.</p>
      ) : (
        <ul className="space-y-3">
          {battles.map((battle) => (
            <li key={battle.id}>
              <Link
                href={`/battles/${battle.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 hover:border-zinc-600"
              >
                <div className="flex items-center gap-2">
                  <BrandThumb brand={battle.brandA} />
                  <span className="text-sm font-medium text-white">{battle.brandA.name}</span>
                </div>
                <span className="text-lg font-bold text-orange-500">VS</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{battle.brandB.name}</span>
                  <BrandThumb brand={battle.brandB} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
