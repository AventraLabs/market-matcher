"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { follows } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { isFollowing } from "@/lib/follow";

export type FollowFormState = { error?: string } | undefined;

/** Toggle follow/unfollow for the current user on one brand. */
export async function toggleFollow(_prevState: FollowFormState, formData: FormData): Promise<FollowFormState> {
  const user = await requireUser();
  const brandId = formData.get("brandId");
  if (typeof brandId !== "string" || !brandId) {
    return { error: "Ungültige Anfrage." };
  }

  const alreadyFollowing = await isFollowing(user.id, brandId);
  if (alreadyFollowing) {
    await db.delete(follows).where(and(eq(follows.userId, user.id), eq(follows.brandId, brandId)));
  } else {
    // onConflictDoNothing: a double-click racing two requests shouldn't 500.
    await db.insert(follows).values({ userId: user.id, brandId }).onConflictDoNothing();
  }

  refresh();
  return undefined;
}
