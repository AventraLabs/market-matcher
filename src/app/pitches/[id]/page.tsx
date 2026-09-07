import { notFound, redirect } from "next/navigation";
import { getBattleById, resolveBattleVideos } from "@/lib/battle";
import { getBattleStage } from "@/lib/battle-stage";
import { BattleVideoUploadForm } from "@/components/battle/battle-video-upload-form";
import { CommentSection } from "@/components/battle/comment-section";
import { getOptionalUser } from "@/lib/session";
import { getBrandForUser } from "@/lib/brand";
import { getVoteTally } from "@/lib/vote";
import { getCommentsForBattle } from "@/lib/comment";

function timeLeftLabel(date: Date): string {
  const hoursLeft = Math.max(0, (date.getTime() - Date.now()) / (60 * 60 * 1000));
  if (hoursLeft >= 24) return `${Math.ceil(hoursLeft / 24)} Tage`;
  return `${Math.max(1, Math.ceil(hoursLeft))}h`;
}

// Phase 10: this page is only the "not live yet" waiting room now — the
// upload form for your own brand, and a place comments can start before
// there's even a video to react to (unchanged from Phase 8). The moment a
// Pitch is actually watchable (both videos in), it only exists in the Feed
// — see FeedDuelCard — so this redirects there instead of maintaining a
// second, separate way to watch/vote on the same Duell.
export default async function PitchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const battle = await getBattleById(id);
  if (!battle) notFound();

  const { videoUrlA, videoUrlB } = resolveBattleVideos(battle);
  const viewer = await getOptionalUser();
  const viewerBrand = viewer ? await getBrandForUser(viewer.id) : null;
  const tally = await getVoteTally(battle.id, battle.brandAId, battle.brandBId);

  const stage = getBattleStage(
    {
      brandAId: battle.brandAId,
      brandBId: battle.brandBId,
      hasVideoA: Boolean(videoUrlA),
      hasVideoB: Boolean(videoUrlB),
      productionDeadline: battle.productionDeadline,
      votingEndsAt: battle.votingEndsAt,
    },
    tally,
  );

  if (stage.stage === "voting" || (stage.stage === "finished" && stage.resolution === "voted")) {
    redirect(`/?battle=${battle.id}`);
  }

  const isOwnBrandA = viewerBrand?.id === battle.brandAId;
  const isOwnBrandB = viewerBrand?.id === battle.brandBId;
  const comments = await getCommentsForBattle(battle.id);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-white">
          {battle.brandA.name} <span className="text-orange-500">vs</span> {battle.brandB.name}
        </h1>
        <p className="mt-2 text-xs uppercase tracking-wide text-zinc-600">{battle.category}</p>
      </div>

      {stage.stage === "awaiting_videos" && (
        <div className="mx-auto max-w-[380px] rounded-xl border border-zinc-800 p-6 text-center">
          <p className="mb-1 text-sm text-zinc-400">
            {stage.waitingOnBrandIds.length === 2
              ? "Beide Seiten müssen noch ihr Video hochladen."
              : `Wartet noch auf ${stage.waitingOnBrandIds[0] === battle.brandAId ? battle.brandA.name : battle.brandB.name}.`}
          </p>
          {stage.deadline && (
            <p className="mb-4 text-xs text-zinc-600">Frist: noch {timeLeftLabel(stage.deadline)}</p>
          )}
          <p className="text-xs text-zinc-600">
            Videos bleiben unsichtbar, bis beide Seiten geliefert haben — erst dann startet der Pitch.
          </p>
          {isOwnBrandA && !videoUrlA && <BattleVideoUploadForm battleId={battle.id} />}
          {isOwnBrandB && !videoUrlB && <BattleVideoUploadForm battleId={battle.id} />}
          {((isOwnBrandA && videoUrlA) || (isOwnBrandB && videoUrlB)) && (
            <p className="mt-4 text-sm text-orange-400">Dein Video ist eingereicht — warte auf die Gegenseite.</p>
          )}
        </div>
      )}

      {/* stage.stage === "finished" here only ever means walkover or no_show
          — a "voted" finish already redirected above. Nothing to watch, so
          just the outcome. */}
      {stage.stage === "finished" && stage.resolution === "walkover" && (
        <p className="mx-auto mt-6 max-w-[380px] rounded-xl border border-zinc-800 p-4 text-center text-sm text-zinc-400">
          🏆 Sieg durch Nichtantritt für{" "}
          <span className="font-semibold text-orange-400">
            {stage.winnerBrandId === battle.brandAId ? battle.brandA.name : battle.brandB.name}
          </span>{" "}
          — die Gegenseite hat ihr Video nicht rechtzeitig hochgeladen.
        </p>
      )}
      {stage.stage === "finished" && stage.resolution === "no_show" && (
        <p className="mx-auto mt-6 max-w-[380px] rounded-xl border border-zinc-800 p-4 text-center text-sm text-zinc-500">
          Keine Seite hat rechtzeitig ein Video hochgeladen — dieser Pitch kam nicht zustande.
        </p>
      )}

      <CommentSection battleId={battle.id} comments={comments} isLoggedIn={Boolean(viewer)} />
    </div>
  );
}
