"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db } from "@/db";
import { battles, brands } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { getBrandForUser } from "@/lib/brand";
import { getExistingOpenBattle } from "@/lib/battle";
import { activateBattleIfBothSidesReady } from "@/lib/battle-stage";
import { uploadVideo, ALLOWED_VIDEO_TYPES } from "@/lib/storage";
import { PITCH_CATEGORY } from "@/lib/battle-format";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // same limit as the profile showcase video

function validateVideoFile(formData: FormData): { file: File } | { error: string } {
  const file = formData.get("video");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bitte ein Video auswählen." };
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return { error: "Video darf maximal 50 MB groß sein." };
  }
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return { error: "Erlaubt: MP4, WEBM oder MOV." };
  }
  return { file };
}

export type UploadBattleVideoFormState = { error?: string } | undefined;

/**
 * Scheduled-mode: one of the two brands in an 'awaiting_videos' battle
 * uploads their side. Once both sides are in, activateBattleIfBothSidesReady
 * opens voting and fires the follower notification.
 */
export async function uploadBattleVideo(
  _prevState: UploadBattleVideoFormState,
  formData: FormData,
): Promise<UploadBattleVideoFormState> {
  const user = await requireUser();
  const battleId = formData.get("battleId");
  if (typeof battleId !== "string" || !battleId) {
    return { error: "Ungültige Anfrage." };
  }

  const myBrand = await getBrandForUser(user.id);
  if (!myBrand) {
    return { error: "Du hast keine Marke." };
  }

  const [battle] = await db.select().from(battles).where(eq(battles.id, battleId)).limit(1);
  if (!battle) {
    return { error: "Dieses Battle existiert nicht." };
  }

  const isA = battle.brandAId === myBrand.id;
  const isB = battle.brandBId === myBrand.id;
  if (!isA && !isB) {
    return { error: "Das ist nicht dein Battle." };
  }
  if ((isA && battle.brandAVideoUrl) || (isB && battle.brandBVideoUrl)) {
    return { error: "Du hast für dieses Battle bereits ein Video hochgeladen." };
  }
  if (battle.productionDeadline && battle.productionDeadline.getTime() < Date.now()) {
    return { error: "Die Frist für dieses Battle ist abgelaufen." };
  }

  const validated = validateVideoFile(formData);
  if ("error" in validated) {
    return { error: validated.error };
  }

  const uploaded = await uploadVideo(validated.file, "battle-videos");
  const now = new Date();

  await db
    .update(battles)
    .set(
      isA
        ? { brandAVideoUrl: uploaded.url, brandASubmittedAt: now }
        : { brandBVideoUrl: uploaded.url, brandBSubmittedAt: now },
    )
    .where(eq(battles.id, battleId));

  await activateBattleIfBothSidesReady(battleId);

  refresh();
  return undefined;
}

export type CounterFormState = { error?: string } | undefined;

/**
 * Open-mode: any brand can counter another brand's public showcase video
 * with their own — no permission needed. This is what lets a brand nobody
 * has challenged (a new startup, say) get into a battle on its own
 * initiative, rather than waiting to be picked.
 */
export async function counterWithVideo(_prevState: CounterFormState, formData: FormData): Promise<CounterFormState> {
  const user = await requireUser();
  const targetBrandId = formData.get("targetBrandId");
  if (typeof targetBrandId !== "string" || !targetBrandId) {
    return { error: "Ungültige Anfrage." };
  }

  const myBrand = await getBrandForUser(user.id);
  if (!myBrand) {
    return { error: "Du musst zuerst eine Marke erstellen, um zu kontern." };
  }
  if (myBrand.id === targetBrandId) {
    return { error: "Du kannst deine eigene Marke nicht kontern." };
  }

  const [targetBrand] = await db.select().from(brands).where(eq(brands.id, targetBrandId)).limit(1);
  if (!targetBrand || !targetBrand.videoUrl) {
    return { error: "Diese Marke hat noch kein Video zum Kontern." };
  }

  const existing = await getExistingOpenBattle(targetBrandId, myBrand.id);
  if (existing) {
    return { error: "Du hast diese Marke bereits gekontert." };
  }

  const validated = validateVideoFile(formData);
  if ("error" in validated) {
    return { error: validated.error };
  }

  const uploaded = await uploadVideo(validated.file, "battle-videos");
  const now = new Date();

  const [battle] = await db
    .insert(battles)
    .values({
      brandAId: targetBrandId,
      brandBId: myBrand.id,
      mode: "open",
      category: PITCH_CATEGORY,
      // Snapshotted, not live-referenced — if targetBrand later replaces
      // their profile video, this battle keeps showing what was actually
      // countered.
      brandAVideoUrl: targetBrand.videoUrl,
      brandASubmittedAt: targetBrand.videoUploadedAt ?? now,
      brandBVideoUrl: uploaded.url,
      brandBSubmittedAt: now,
    })
    .returning();

  await activateBattleIfBothSidesReady(battle.id);

  // Straight to the new battle — the countering brand should see their
  // shot land immediately, not just a success message on the old page.
  redirect(`/battles/${battle.id}`);
}
