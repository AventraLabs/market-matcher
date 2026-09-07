import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/session";
import { saveSubscription } from "@/lib/push";

export async function POST(request: NextRequest) {
  const viewer = await getOptionalUser();
  if (!viewer) {
    return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { endpoint, p256dh, auth } = body ?? {};
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  await saveSubscription({ userId: viewer.id, endpoint, p256dh, auth });
  return NextResponse.json({ ok: true });
}
