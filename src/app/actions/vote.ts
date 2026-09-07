"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/session";
import { castVoteForUser } from "@/lib/vote";

export type VoteFormState = { error?: string } | undefined;

export async function castVote(_prevState: VoteFormState, formData: FormData): Promise<VoteFormState> {
  const user = await requireUser();
  const battleId = formData.get("battleId");
  const votedForBrandId = formData.get("votedForBrandId");
  if (typeof battleId !== "string" || typeof votedForBrandId !== "string" || !battleId || !votedForBrandId) {
    return { error: "Ungültige Anfrage." };
  }

  const result = await castVoteForUser(user.id, battleId, votedForBrandId);
  if (result.error) {
    return { error: result.error };
  }

  refresh();
  return undefined;
}
