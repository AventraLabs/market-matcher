import Link from "next/link";
import { getAllBattles, resolveBattleVideos } from "@/lib/battle";
import { getBattleStage } from "@/lib/battle-stage";
import { getOptionalUser } from "@/lib/session";
import { getRemindedBattleIds } from "@/lib/reminder";
import { ReminderButton } from "@/components/pitches/reminder-button";

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

function deadlineLabel(deadline: Date | null): string | null {
  if (!deadline) return null;
  const hoursLeft = Math.max(0, (deadline.getTime() - Date.now()) / (60 * 60 * 1000));
  const label = hoursLeft >= 24 ? `noch ${Math.ceil(hoursLeft / 24)} Tage` : `noch ${Math.max(1, Math.ceil(hoursLeft))}h`;
  return `Kommt spätestens in ${label}`;
}

// Phase 10: this is now purely a "kommt bald" preview — every Duell that's
// still waiting on at least one video. A Duell with both videos in is only
// ever watched/voted on in the Feed (see src/lib/feed.ts's eligibility
// filter and page.tsx's redirect for the old per-battle URL) — showing it
// here too was the exact overlap the user flagged: two different-looking
// places to do the same thing, one of them a dead end with no way back.
// So the split is now clean: Pitches = anticipation + reminders,
// Feed = the only place to actually watch/vote/comment.
export default async function PitchesPage() {
  const viewer = await getOptionalUser();
  const battles = await getAllBattles();
  const remindedIds = viewer ? new Set(await getRemindedBattleIds(viewer.id)) : new Set<string>();

  const upcoming = battles.filter((battle) => {
    const { videoUrlA, videoUrlB } = resolveBattleVideos(battle);
    const stage = getBattleStage({
      brandAId: battle.brandAId,
      brandBId: battle.brandBId,
      hasVideoA: Boolean(videoUrlA),
      hasVideoB: Boolean(videoUrlB),
      productionDeadline: battle.productionDeadline,
      votingEndsAt: battle.votingEndsAt,
    });
    return stage.stage === "awaiting_videos";
  });

  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
      <h1 className="mb-1 text-2xl font-bold text-white">Pitches</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Kommende Duelle — merk dir eins vor, dann sagen wir dir Bescheid, sobald es live geht. Laufende und beendete
        Pitches siehst du im <Link href="/" className="text-orange-400 hover:underline">Feed</Link>.
      </p>

      {upcoming.length === 0 ? (
        <p className="text-sm text-zinc-500">Gerade kommt nichts Neues — schau später wieder vorbei.</p>
      ) : (
        <ul className="space-y-3">
          {upcoming.map((battle) => {
            const { videoUrlA, videoUrlB } = resolveBattleVideos(battle);
            const stage = getBattleStage({
              brandAId: battle.brandAId,
              brandBId: battle.brandBId,
              hasVideoA: Boolean(videoUrlA),
              hasVideoB: Boolean(videoUrlB),
              productionDeadline: battle.productionDeadline,
              votingEndsAt: battle.votingEndsAt,
            });
            const deadline = stage.stage === "awaiting_videos" ? deadlineLabel(stage.deadline) : null;

            return (
              <li key={battle.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BrandThumb brand={battle.brandA} />
                    <span className="text-sm font-medium text-white">{battle.brandA.name}</span>
                  </div>
                  <span className="text-lg font-bold text-orange-500">VS</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{battle.brandB.name}</span>
                    <BrandThumb brand={battle.brandB} />
                  </div>
                </div>
                <p className="mt-3 text-center text-xs text-zinc-500">{battle.category}</p>
                <div className="mt-3 flex items-center justify-center gap-3">
                  {deadline && <span className="text-xs text-zinc-600">{deadline}</span>}
                  {viewer ? (
                    <ReminderButton battleId={battle.id} hasReminder={remindedIds.has(battle.id)} />
                  ) : (
                    <Link href="/login" className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-orange-400 hover:text-orange-400">
                      🔔 Anmelden zum Erinnern
                    </Link>
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
