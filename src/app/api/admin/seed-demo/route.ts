import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { seedDemoContent } from "@/lib/seed-demo-data";

// Phase 12: a browser-visitable way to (re)seed demo content — the point is
// specifically that populating a fresh Vercel deployment's prod database
// never requires a terminal or copying a DATABASE_URL anywhere. Visit
// /api/admin/seed-demo?key=<ADMIN_SEED_KEY> once after each deploy (it's
// idempotent — see seedDemoContent's own comment — so visiting it again
// just re-rolls the same fictional dataset, harmless).
//
// Protected by a single shared-secret query param rather than requiring
// login as a specific admin account — there's no admin-role concept in this
// app yet, and the operation is scoped to fully namespaced, disposable demo
// rows (see seedDemoContent), so a leaked key's worst case is someone
// re-rolling the demo dataset, not touching real data.
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const expected = process.env.ADMIN_SEED_KEY;

  if (!expected) {
    return new NextResponse(
      "ADMIN_SEED_KEY ist in den Vercel-Umgebungsvariablen nicht gesetzt — siehe README §5.",
      { status: 500 },
    );
  }
  if (key !== expected) {
    return new NextResponse("Falscher oder fehlender Key.", { status: 403 });
  }

  try {
    const result = await seedDemoContent(db);
    return new NextResponse(
      `OK — ${result.brands} Marken, ${result.battles} Pitches, ${result.viewers} Demo-Zuschauer angelegt. Du kannst dieses Tab jetzt schließen und den Feed öffnen.`,
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  } catch (err) {
    console.error("[admin/seed-demo]", err);
    return new NextResponse("Fehler beim Seeden — siehe Vercel-Logs.", { status: 500 });
  }
}
