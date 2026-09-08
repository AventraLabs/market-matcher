import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Phase 12c: runtime migration runner, mirroring seed-demo-data.ts's own
// rationale — applying schema changes to the production database shouldn't
// require anyone to copy a DATABASE_URL into a terminal. This is the exact
// same logic as src/db/migrate.ts (the CLI script used for local dev), just
// callable from a request handler instead of `tsx`.
//
// Uses its own short-lived connection (max: 1) rather than the shared `db`
// from src/db/index.ts, because a migration should hold one dedicated
// connection for its single transaction, separate from the app's pool.
// `prepare: false` matches src/db/index.ts — required for Supabase's pooled
// connection string (pgbouncer in transaction mode); the migrator only runs
// plain DDL/DML inside one transaction, no prepared statements, so this is
// safe over that pooling mode too.
export async function runPendingMigrations(): Promise<{ ranTo: string }> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }
  const migrationClient = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  try {
    const db = drizzle(migrationClient);
    await migrate(db, { migrationsFolder: "./drizzle" });
    return { ranTo: "latest" };
  } finally {
    await migrationClient.end();
  }
}
