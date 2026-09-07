import "server-only";
import { desc, eq } from "drizzle-orm";
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
