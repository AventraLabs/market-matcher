import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { battleReminders } from "@/db/schema";

export async function hasReminder(userId: string, battleId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: battleReminders.id })
    .from(battleReminders)
    .where(and(eq(battleReminders.userId, userId), eq(battleReminders.battleId, battleId)))
    .limit(1);
  return Boolean(row);
}

/** Every battle this user has a reminder on — used to render the toggle state on /pitches. */
export async function getRemindedBattleIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ battleId: battleReminders.battleId })
    .from(battleReminders)
    .where(eq(battleReminders.userId, userId));
  return rows.map((r) => r.battleId);
}

/** Every user who set a reminder on this battle — used to fan out the "it's live" notification. */
export async function getReminderUserIds(battleId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: battleReminders.userId })
    .from(battleReminders)
    .where(eq(battleReminders.battleId, battleId));
  return rows.map((r) => r.userId);
}
