import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { brands, brandMembers } from "@/db/schema";

/** The single brand a user owns/belongs to (Phase 2: at most one). */
export async function getBrandForUser(userId: string) {
  const [row] = await db
    .select({ brand: brands })
    .from(brandMembers)
    .innerJoin(brands, eq(brandMembers.brandId, brands.id))
    .where(eq(brandMembers.userId, userId))
    .limit(1);
  return row?.brand ?? null;
}
