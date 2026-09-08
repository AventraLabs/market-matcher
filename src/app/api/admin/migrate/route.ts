import { NextRequest, NextResponse } from "next/server";
import { runPendingMigrations } from "@/lib/db-migrate";

// Phase 12c: browser-visitable schema migration, same shape and same shared
// secret as /api/admin/seed-demo (see that route's comment). This exists
// because deploying new code to Vercel does NOT automatically apply pending
// SQL migrations to the (Supabase) database — that step was missing from
// Phase 11/12's rollout, which is why the first production deploy 500'd on
// every request that touched the `battles` table (it selects a column,
// result_notified_at, that only exists in application code's schema, not
// yet in the actual database) and the demo-seed endpoint failed the same
// way (it writes to push_subscriptions, a table that didn't exist yet).
//
// Visit /api/admin/migrate?key=<ADMIN_SEED_KEY> once after each deploy that
// changes src/db/schema.ts, BEFORE visiting /api/admin/seed-demo. It's safe
// to visit again later (drizzle's migrator tracks what already ran and is a
// no-op if nothing is pending).
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
    await runPendingMigrations();
    return new NextResponse(
      "OK — Datenbank-Schema ist jetzt aktuell. Du kannst jetzt /api/admin/seed-demo aufrufen (falls noch nicht geschehen) und danach den Feed öffnen.",
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  } catch (err) {
    console.error("[admin/migrate]", err);
    const detail = err instanceof Error ? err.message : String(err);
    return new NextResponse(`Fehler bei der Migration: ${detail}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
