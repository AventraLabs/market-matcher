"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { battles, challenges } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { getBrandForUser } from "@/lib/brand";
import { CHALLENGE_WINDOW_MS, effectiveStatus, getLivePendingChallengeBetween } from "@/lib/challenge";
import { PITCH_CATEGORY, PRODUCTION_WINDOW_MS } from "@/lib/battle-format";

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

  // Phase 7: accepting a challenge creates the battle row right away, but
  // it starts in "awaiting_videos" — no videos yet, nothing votable, nobody
  // notified. Both brands now have PRODUCTION_WINDOW_MS to each upload
  // their own video via uploadBattleVideo (src/app/actions/battle.ts),
  // which is also what flips it into "voting" and fires the "battle is
  // live" notification once both sides are in. Deliberately verdeckt: the
  // point is neither side can see (or react to) the other's video before
  // posting their own.
  if (decision === "accept") {
    await db.insert(battles).values({
      challengeId: challenge.id,
      brandAId: challenge.challengerBrandId,
      brandBId: challenge.challengedBrandId,
      mode: "scheduled",
      category: PITCH_CATEGORY,
      productionDeadline: new Date(Date.now() + PRODUCTION_WINDOW_MS),
    });
  }

  refresh();
  return undefined;
}
