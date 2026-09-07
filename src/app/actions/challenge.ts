"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { battles, brands, challenges, notifications, type NewNotification } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { getBrandForUser } from "@/lib/brand";
import { CHALLENGE_WINDOW_MS, effectiveStatus, getLivePendingChallengeBetween } from "@/lib/challenge";
import { getFollowerUserIds } from "@/lib/follow";

export type ChallengeFormState = { error?: string } | undefined;

/** Brand A challenges Brand B. Triggered from B's public profile page. */
export async function sendChallenge(_prevState: ChallengeFormState, formData: FormData): Promise<ChallengeFormState> {
  const user = await requireUser();
  const challengedBrandId = formData.get("challengedBrandId");
  if (typeof challengedBrandId !== "string" || !challengedBrandId) {
    return { error: "Ungültige Anfrage." };
  }

  const myBrand = await getBrandForUser(user.id);
  if (!myBrand) {
    return { error: "Du musst zuerst eine Marke erstellen, um herauszufordern." };
  }
  if (myBrand.id === challengedBrandId) {
    return { error: "Du kannst deine eigene Marke nicht herausfordern." };
  }

  const existing = await getLivePendingChallengeBetween(myBrand.id, challengedBrandId);
  if (existing) {
    return { error: "Zwischen euch läuft bereits eine offene Herausforderung." };
  }

  await db.insert(challenges).values({
    challengerBrandId: myBrand.id,
    challengedBrandId,
    status: "pending",
    expiresAt: new Date(Date.now() + CHALLENGE_WINDOW_MS),
  });

  refresh();
  return undefined;
}

export type RespondFormState = { error?: string } | undefined;

/** The challenged brand accepts or declines. */
export async function respondToChallenge(_prevState: RespondFormState, formData: FormData): Promise<RespondFormState> {
  const user = await requireUser();
  const challengeId = formData.get("challengeId");
  const decision = formData.get("decision");
  if (typeof challengeId !== "string" || (decision !== "accept" && decision !== "decline")) {
    return { error: "Ungültige Anfrage." };
  }

  const myBrand = await getBrandForUser(user.id);
  if (!myBrand) {
    return { error: "Du hast keine Marke." };
  }

  const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
  if (!challenge || challenge.challengedBrandId !== myBrand.id) {
    return { error: "Diese Herausforderung existiert nicht für deine Marke." };
  }

  const status = effectiveStatus(challenge);
  if (status === "expired") {
    // Persist the expiry so it stops showing up as actionable.
    await db.update(challenges).set({ status: "expired" }).where(eq(challenges.id, challengeId));
    return { error: "Diese Herausforderung ist abgelaufen — das Zeitfenster ist vorbei." };
  }
  if (status !== "pending") {
    return { error: "Auf diese Herausforderung wurde bereits reagiert." };
  }

  await db
    .update(challenges)
    .set({ status: decision === "accept" ? "accepted" : "declined", respondedAt: new Date() })
    .where(eq(challenges.id, challengeId));

  // Phase 5: accepting a challenge is what turns it into a battle — the
  // page that shows both brands' content head to head.
  if (decision === "accept") {
    const [battle] = await db
      .insert(battles)
      .values({
        challengeId: challenge.id,
        brandAId: challenge.challengerBrandId,
        brandBId: challenge.challengedBrandId,
      })
      .returning();

    await notifyFollowersOfNewBattle(battle.id, challenge.challengerBrandId, challenge.challengedBrandId);
  }

  refresh();
  return undefined;
}

/**
 * Phase 5.1: tell everyone following either brand that their battle just
 * went live — so they hear about it without having to keep checking back.
 * Someone following both brands gets two notifications (one per side);
 * that's an acceptable rough edge for now rather than special-casing it.
 */
async function notifyFollowersOfNewBattle(battleId: string, challengerBrandId: string, challengedBrandId: string) {
  const [challengerBrand, challengedBrand] = await Promise.all([
    db.select({ name: brands.name }).from(brands).where(eq(brands.id, challengerBrandId)).limit(1),
    db.select({ name: brands.name }).from(brands).where(eq(brands.id, challengedBrandId)).limit(1),
  ]);
  const challengerName = challengerBrand[0]?.name ?? "Eine Marke";
  const challengedName = challengedBrand[0]?.name ?? "eine Marke";

  const [challengerFollowers, challengedFollowers] = await Promise.all([
    getFollowerUserIds(challengerBrandId),
    getFollowerUserIds(challengedBrandId),
  ]);

  const rows: NewNotification[] = [
    ...challengerFollowers.map((userId) => ({
      userId,
      message: `⚔️ ${challengerName} battelt jetzt gegen ${challengedName}!`,
      battleId,
    })),
    ...challengedFollowers.map((userId) => ({
      userId,
      message: `⚔️ ${challengedName} battelt jetzt gegen ${challengerName}!`,
      battleId,
    })),
  ];

  if (rows.length > 0) {
    await db.insert(notifications).values(rows);
  }
}
