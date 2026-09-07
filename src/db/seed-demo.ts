import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "dotenv";
import * as schema from "./schema";
import { seedDemoContent, DEMO_EMAIL_DOMAIN, DEMO_PASSWORD } from "@/lib/seed-demo-data";

// CLI entry point — usage: npm run db:seed-demo
// The actual seeding logic lives in src/lib/seed-demo-data.ts, shared with
// the browser-visitable /api/admin/seed-demo route (see that file's
// comment for why: seeding a Vercel deployment's prod DB shouldn't require
// anyone to copy a DATABASE_URL into a terminal).

config({ path: ".env.local" });
config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set.");
}

const client = postgres(process.env.DATABASE_URL, { prepare: false });
const db = drizzle(client, { schema });

seedDemoContent(db)
  .then((result) => {
    console.log(`Done. ${result.brands} brands, ${result.battles} battles, ${result.viewers} viewers.`);
    console.log(`Demo accounts share the password: ${DEMO_PASSWORD}`);
    console.log(`e.g. log in as demo-owner-sprintex@${DEMO_EMAIL_DOMAIN} to see a brand's own view.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => client.end());
