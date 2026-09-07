"use server";

import { and, eq, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { battles, brandMembers, votes } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { getUserVote } from "@/lib/vote";

export type VoteFormState = { error?: string } | undefined;

export async function castVote(_prevState: VoteFormState, formData: FormData): Promise<VoteFormState> {
  const user = await requireUser();
  const battleId = formData.get("battleId");
  const votedForBrandId = formData.get("votedForBrandId");
  if (typeof battleId !== "string" || typeof votedForBrandId !== "string" || !battleId || !votedForBrandId) {
    return { error: "Ungültige Anfrage." };
  }

  const [battle] = await db.select().from(battles).where(eq(battles.id, battleId)).limit(1);
  if (!battle) {
    return { error: "Dieses Battle existiert nicht." };
  }
  if (votedForBrandId !== battle.brandAId && votedForBrandId !== battle.brandBId) {
    return { error: "Ungültige Marke für dieses Battle." };
  }

  // A brand's own team can't vote in its own battle — keeps the count honest.
  const [ownMembership] = await db
    .select({ brandId: brandMembers.brandId })
    .from(brandMembers)
    .where(
      and(
        eq(brandMembers.userId, user.id),
        or(eq(brandMembers.brandId, battle.brandAId), eq(brandMembers.brandId, battle.brandBId)),
      ),
    )
    .limit(1);
  if (ownMembership) {
    return { error: "Du kannst nicht bei einem Battle deiner eigenen Marke abstimmen." };
  }

  const existingVote = await getUserVote(battleId, user.id);
  if (existingVote) {
    return { error: "Du hast bereits abgestimmt." };
  }

  // onConflictDoNothing: the unique index on (battleId, userId) is the real
  // backstop against a double-vote race — the check above is just for a
  // friendly error message in the normal case.
  await db.insert(votes).values({ battleId, userId: user.id, votedForBrandId }).onConflictDoNothing();

  refresh();
  return undefined;
}
