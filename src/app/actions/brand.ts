"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { brands, brandMembers } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { uploadImage, ALLOWED_IMAGE_TYPES } from "@/lib/storage";
import { CreateBrandSchema } from "@/lib/validation";

export type BrandFormState = { errors?: Record<string, string[]> } | undefined;

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 60);
  return base || "marke";
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 1;
  // Small table, small N — a loop is simpler and clearer than a clever query.
  while (true) {
    const [clash] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, candidate)).limit(1);
    if (!clash) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

export async function createBrand(_prevState: BrandFormState, formData: FormData): Promise<BrandFormState> {
  const user = await requireUser();

  // One brand per user for Phase 2 — brand_members exists as its own table
  // so lifting this to teams later doesn't need a migration.
  const [existingMembership] = await db
    .select({ id: brandMembers.id })
    .from(brandMembers)
    .where(eq(brandMembers.userId, user.id))
    .limit(1);
  if (existingMembership) {
    return { errors: { _form: ["Du hast bereits eine Marke erstellt."] } };
  }

  const parsed = CreateBrandSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    website: formData.get("website"),
    category: formData.get("category"),
    country: formData.get("country"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  let logoUrl: string | null = null;
  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    if (logoFile.size > MAX_LOGO_BYTES) {
      return { errors: { logo: ["Logo darf maximal 2 MB groß sein."] } };
    }
    if (!ALLOWED_IMAGE_TYPES.includes(logoFile.type)) {
      return { errors: { logo: ["Erlaubt: PNG, JPEG, WEBP oder SVG."] } };
    }
    const uploaded = await uploadImage(logoFile, "logos");
    logoUrl = uploaded.url;
  }

  const slug = await uniqueSlug(parsed.data.name);

  const [brand] = await db
    .insert(brands)
    .values({
      name: parsed.data.name,
      slug,
      description: parsed.data.description || null,
      website: parsed.data.website || null,
      category: parsed.data.category,
      country: parsed.data.country,
      logoUrl,
    })
    .returning({ id: brands.id, slug: brands.slug });

  await db.insert(brandMembers).values({ brandId: brand.id, userId: user.id, role: "owner" });

  redirect(`/brands/${brand.slug}`);
}
