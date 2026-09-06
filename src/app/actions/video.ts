"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { brands, brandMembers } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { uploadVideo, ALLOWED_VIDEO_TYPES } from "@/lib/storage";

export type VideoFormState = { errors?: Record<string, string[]>; success?: boolean } | undefined;

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB — generous for a short vertical clip

export async function uploadBrandVideo(_prevState: VideoFormState, formData: FormData): Promise<VideoFormState> {
  const user = await requireUser();

  const [membership] = await db
    .select({ brandId: brandMembers.brandId })
    .from(brandMembers)
    .where(eq(brandMembers.userId, user.id))
    .limit(1);
  if (!membership) {
    return { errors: { _form: ["Du musst zuerst eine Marke erstellen."] } };
  }

  const file = formData.get("video");
  if (!(file instanceof File) || file.size === 0) {
    return { errors: { video: ["Bitte ein Video auswählen."] } };
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return { errors: { video: ["Video darf maximal 50 MB groß sein."] } };
  }
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return { errors: { video: ["Erlaubt: MP4, WEBM oder MOV."] } };
  }

  // "Verarbeitung" for Phase 3 is upload + storage — there's no transcoding
  // pipeline yet (ffmpeg isn't available in a default Vercel serverless
  // function), so the pending state the user sees during a slow mobile
  // upload *is* the processing step for now. Revisit once video needs to be
  // normalized (thumbnails, compression) for the actual battle feed.
  const uploaded = await uploadVideo(file, "videos");

  await db
    .update(brands)
    .set({ videoUrl: uploaded.url, videoUploadedAt: new Date(), updatedAt: new Date() })
    .where(eq(brands.id, membership.brandId));

  // Next.js 16 no longer refreshes the invoking route automatically after a
  // Server Action — without this, the newly uploaded video wouldn't show up
  // on /profile until a manual reload (its own page fetch is unaffected;
  // this is only about *this* route's already-rendered server tree).
  refresh();

  return { success: true };
}
