import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

async function main() {
  const migrationClient = postgres(process.env.DATABASE_URL as string, { max: 1 });
  const db = drizzle(migrationClient);
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Done.");
  await migrationClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
