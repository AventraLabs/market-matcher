"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { battleReminders } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { hasReminder } from "@/lib/reminder";

export type ReminderFormState = { error?: string } | undefined;

/** Toggle a reminder for the current user on one upcoming battle. */
export async function toggleReminder(_prevState: ReminderFormState, formData: FormData): Promise<ReminderFormState> {
  const user = await requireUser();
  const battleId = formData.get("battleId");
  if (typeof battleId !== "string" || !battleId) {
    return { error: "Ungültige Anfrage." };
  }

  const alreadySet = await hasReminder(user.id, battleId);
  if (alreadySet) {
    await db.delete(battleReminders).where(and(eq(battleReminders.userId, user.id), eq(battleReminders.battleId, battleId)));
  } else {
    // onConflictDoNothing: a double-click racing two requests shouldn't 500.
    await db.insert(battleReminders).values({ userId: user.id, battleId }).onConflictDoNothing();
  }

  refresh();
  return undefined;
}
