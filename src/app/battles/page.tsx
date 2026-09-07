import Link from "next/link";
import { getAllBattles, resolveBattleVideos } from "@/lib/battle";
import { getBattleStage } from "@/lib/battle-stage";
import { getVoteTotals } from "@/lib/vote";

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

function StageBadge({ stage }: { stage: ReturnType<typeof getBattleStage>["stage"] }) {
  const label =
    stage === "awaiting_videos" ? "Läuft noch — Videos ausstehend" : stage === "voting" ? "Abstimmung läuft" : "Beendet";
  const cls =
    stage === "awaiting_videos"
      ? "bg-zinc-800 text-zinc-400"
      : stage === "voting"
        ? "bg-orange-500/10 text-orange-400"
        : "bg-zinc-800 text-zinc-500";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export default async function BattlesPage() {
  const battles = await getAllBattles();
  const voteTotals = await getVoteTotals(battles.map((b) => b.id));

  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-white">Battles</h1>

      {battles.length === 0 ? (
        <p className="text-sm text-zinc-500">Noch keine Battles — Herausforderungen annehmen, um eins zu starten.</p>
      ) : (
        <ul className="space-y-3">
          {battles.map((battle) => {
            const { videoUrlA, videoUrlB } = resolveBattleVideos(battle);
            const stage = getBattleStage({
              brandAId: battle.brandAId,
              brandBId: battle.brandBId,
              hasVideoA: Boolean(videoUrlA),
              hasVideoB: Boolean(videoUrlB),
              productionDeadline: battle.productionDeadline,
              votingEndsAt: battle.votingEndsAt,
            });
            const total = voteTotals.get(battle.id) ?? 0;
            return (
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
                <div className="mt-1 flex items-center justify-center gap-2">
                  <StageBadge stage={stage.stage} />
                  {stage.stage !== "awaiting_videos" && (
                    <span className="text-xs text-zinc-600">
                      {total} {total === 1 ? "Stimme" : "Stimmen"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
