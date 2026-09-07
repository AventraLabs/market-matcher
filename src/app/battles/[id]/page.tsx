import { notFound } from "next/navigation";
import { getBattleById } from "@/lib/battle";
import { BattleViewer } from "@/components/battle/battle-viewer";
import { VotePanel } from "@/components/battle/vote-panel";
import { getOptionalUser } from "@/lib/session";
import { getBrandForUser } from "@/lib/brand";
import { getUserVote, getVoteTally } from "@/lib/vote";

export default async function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const battle = await getBattleById(id);
  if (!battle) notFound();

  const viewer = await getOptionalUser();
  const [viewerBrand, tally, userVote] = await Promise.all([
    viewer ? getBrandForUser(viewer.id) : null,
    getVoteTally(battle.id, battle.brandAId, battle.brandBId),
    viewer ? getUserVote(battle.id, viewer.id) : null,
  ]);
  const canVote = Boolean(viewer) && viewerBrand?.id !== battle.brandAId && viewerBrand?.id !== battle.brandBId;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-white">
          {battle.brandA.name} <span className="text-orange-500">vs</span> {battle.brandB.name}
        </h1>
      </div>

      <BattleViewer brandA={battle.brandA} brandB={battle.brandB} />

      <VotePanel
        battleId={battle.id}
        brandA={battle.brandA}
        brandB={battle.brandB}
        tally={tally}
        userVote={userVote}
        canVote={canVote}
        isLoggedIn={Boolean(viewer)}
      />
    </div>
  );
}
