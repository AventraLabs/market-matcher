import { notFound } from "next/navigation";
import { getBattleById } from "@/lib/battle";
import { BattleViewer } from "@/components/battle/battle-viewer";

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
        <p className="mt-2 text-sm text-zinc-500">Voting startet in Phase 6 — schau dir schon mal beide Seiten an.</p>
      </div>

      <BattleViewer brandA={battle.brandA} brandB={battle.brandB} />
    </div>
  );
}
