import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { battles } from "@/db/schema";
import { getOptionalUser } from "@/lib/session";
import { getLikeCount, toggleLikeForUser } from "@/lib/like";

export async function POST(request: NextRequest) {
  const viewer = await getOptionalUser();
  if (!viewer) {
    return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const battleId = body?.battleId;
  const brandId = body?.brandId;
  if (typeof battleId !== "string" || typeof brandId !== "string" || !battleId || !brandId) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const [battle] = await db.select().from(battles).where(eq(battles.id, battleId)).limit(1);
  if (!battle || (brandId !== battle.brandAId && brandId !== battle.brandBId)) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const { liked } = await toggleLikeForUser(viewer.id, battleId, brandId);
  const count = await getLikeCount(battleId, brandId);
  return NextResponse.json({ liked, count });
}
