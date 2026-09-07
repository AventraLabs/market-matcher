import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { battles, comments } from "@/db/schema";
import { getOptionalUser } from "@/lib/session";
import { getCommentsForBattle } from "@/lib/comment";

const MAX_COMMENT_LENGTH = 500;

/** Load a battle's comment thread — used to open the feed's comment sheet. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const battleId = searchParams.get("battleId");
  if (!battleId) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const list = await getCommentsForBattle(battleId);
  return NextResponse.json({ comments: list });
}

export async function POST(request: NextRequest) {
  const viewer = await getOptionalUser();
  if (!viewer) {
    return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const battleId = body?.battleId;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (typeof battleId !== "string" || !battleId) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: "Kommentar darf nicht leer sein." }, { status: 400 });
  }
  if (content.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json(
      { error: `Kommentar darf maximal ${MAX_COMMENT_LENGTH} Zeichen lang sein.` },
      { status: 400 },
    );
  }

  const [battle] = await db.select({ id: battles.id }).from(battles).where(eq(battles.id, battleId)).limit(1);
  if (!battle) {
    return NextResponse.json({ error: "Dieser Pitch existiert nicht." }, { status: 404 });
  }

  await db.insert(comments).values({ battleId, userId: viewer.id, content });
  const list = await getCommentsForBattle(battleId);
  return NextResponse.json({ comments: list });
}
