import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { battles, brands, type Battle } from "@/db/schema";

type BattleBrand = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  videoUrl: string | null;
};

export type BattleWithBrands = Battle & { brandA: BattleBrand; brandB: BattleBrand };

/**
 * The video to actually show/count for each side. Battles created before
 * Phase 7 have no per-battle video (brandAVideoUrl/brandBVideoUrl are
 * null) and relied on each brand's profile showcase video instead — this
 * keeps those old rows working without a backfill migration.
 *
 * The fallback only applies to those genuinely old rows — detected by
 * `productionDeadline` being null on a 'scheduled' battle, which can only
 * happen on a pre-Phase-7 row, since respondToChallenge always sets it
 * now. Without this guard, a brand that already has a Phase 3 profile
 * video would look like it had already submitted its side of a brand-new
 * battle it hasn't touched yet, skipping "awaiting_videos" entirely.
 */
export function resolveBattleVideos(battle: BattleWithBrands): { videoUrlA: string | null; videoUrlB: string | null } {
  const isLegacyRow = battle.mode === "scheduled" && battle.productionDeadline === null;
  if (isLegacyRow) {
    return { videoUrlA: battle.brandA.videoUrl, videoUrlB: battle.brandB.videoUrl };
  }
  return { videoUrlA: battle.brandAVideoUrl, videoUrlB: battle.brandBVideoUrl };
}

const brandCols = {
  id: brands.id,
  name: brands.name,
  slug: brands.slug,
  logoUrl: brands.logoUrl,
  videoUrl: brands.videoUrl,
};

async function attachBrands(rows: Battle[]): Promise<BattleWithBrands[]> {
  if (rows.length === 0) return [];
  const allBrands = await db.select(brandCols).from(brands);
  const byId = new Map(allBrands.map((b) => [b.id, b]));
  return rows
    .map((battle) => {
      const brandA = byId.get(battle.brandAId);
      const brandB = byId.get(battle.brandBId);
      if (!brandA || !brandB) return null; // shouldn't happen (FKs), but keep this safe
      return { ...battle, brandA, brandB };
    })
    .filter((b): b is BattleWithBrands => b !== null);
}

export async function getAllBattles(): Promise<BattleWithBrands[]> {
  const rows = await db.select().from(battles).orderBy(desc(battles.createdAt));
  return attachBrands(rows);
}

export async function getBattleById(id: string): Promise<BattleWithBrands | null> {
  const [row] = await db.select().from(battles).where(eq(battles.id, id)).limit(1);
  if (!row) return null;
  const [withBrands] = await attachBrands([row]);
  return withBrands ?? null;
}

/** Battles this brand is part of, either side. */
export async function getBattlesForBrand(brandId: string): Promise<BattleWithBrands[]> {
  const all = await getAllBattles();
  return all.filter((b) => b.brandAId === brandId || b.brandBId === brandId);
}

/**
 * Is there already an 'open' battle where `challengerBrandId` countered
 * `targetBrandId`? Used to stop the same brand from countering the same
 * target over and over — one open battle between a given pair at a time,
 * same spirit as getLivePendingChallengeBetween for the scheduled flow.
 */
export async function getExistingOpenBattle(targetBrandId: string, challengerBrandId: string) {
  const [row] = await db
    .select()
    .from(battles)
    .where(
      and(eq(battles.mode, "open"), eq(battles.brandAId, targetBrandId), eq(battles.brandBId, challengerBrandId)),
    )
    .limit(1);
  return row ?? null;
}
