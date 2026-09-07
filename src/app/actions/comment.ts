"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { battles, comments } from "@/db/schema";
import { requireUser } from "@/lib/session";

export type CommentFormState = { error?: string } | undefined;

const MAX_COMMENT_LENGTH = 500;

/** Anyone signed in can comment — Acro or Assent, including a Pitch's own brands. */
export async function postComment(_prevState: CommentFormState, formData: FormData): Promise<CommentFormState> {
  const user = await requireUser();
  const battleId = formData.get("battleId");
  const content = formData.get("content");

  if (typeof battleId !== "string" || !battleId) {
    return { error: "Ungültige Anfrage." };
  }
  if (typeof content !== "string" || !content.trim()) {
    return { error: "Kommentar darf nicht leer sein." };
  }
  if (content.length > MAX_COMMENT_LENGTH) {
    return { error: `Kommentar darf maximal ${MAX_COMMENT_LENGTH} Zeichen lang sein.` };
  }

  const [battle] = await db.select({ id: battles.id }).from(battles).where(eq(battles.id, battleId)).limit(1);
  if (!battle) {
    return { error: "Dieser Pitch existiert nicht." };
  }

  await db.insert(comments).values({ battleId, userId: user.id, content: content.trim() });

  refresh();
  return undefined;
}
