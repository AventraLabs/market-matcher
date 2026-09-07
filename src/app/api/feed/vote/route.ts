import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { battles } from "@/db/schema";
import { getOptionalUser } from "@/lib/session";
import { castVoteForUser, getVoteTally } from "@/lib/vote";

export async function POST(request: NextRequest) {
  const viewer = await getOptionalUser();
  if (!viewer) {
    return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const battleId = body?.battleId;
  const votedForBrandId = body?.votedForBrandId;
  if (typeof battleId !== "string" || typeof votedForBrandId !== "string" || !battleId || !votedForBrandId) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const result = await castVoteForUser(viewer.id, battleId, votedForBrandId);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const [battle] = await db.select().from(battles).where(eq(battles.id, battleId)).limit(1);
  const tally = battle ? await getVoteTally(battle.id, battle.brandAId, battle.brandBId) : null;
  return NextResponse.json({ tally, votedForBrandId });
}
