import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { battles, brands, votes } from "@/db/schema";
import { getVoteTallyAsOf } from "@/lib/vote";
import { sendPushToUser } from "@/lib/push";

/**
 * Phase 12: "your Pitch's result is in" push. There's no cron job in this
 * app — see battle-stage.ts's own philosophy of computing everything at
 * read time — so this piggybacks on the busiest read path there is, the
 * feed (buildFeedDuels in src/lib/feed.ts calls this via next/server's
 * after() for every battle that just turned out to be finished-and-voted
 * with resultNotifiedAt still null). On a platform whose whole pitch is
 * "people check back every few minutes", that's a tighter notification
 * delay in practice than a once-a-day Vercel Hobby-plan cron could give
 * anyway, and it costs nothing when nobody's browsing.
 *
 * The UPDATE ... WHERE result_notified_at IS NULL is the concurrency guard:
 * if several requests race to finalize the same battle at once (normal —
 * this isn't behind a lock), only the one that actually flips the column
 * from NULL proceeds to send anything. Everyone else's claim affects 0 rows
 * and returns immediately.
 */
export async function finalizeAndNotifyBattle(battleId: string): Promise<void> {
  const claimed = await db
    .update(battles)
    .set({ resultNotifiedAt: new Date() })
    .where(and(eq(battles.id, battleId), isNull(battles.resultNotifiedAt)))
    .returning({
      id: battles.id,
      brandAId: battles.brandAId,
      brandBId: battles.brandBId,
      votingEndsAt: battles.votingEndsAt,
    });
  if (claimed.length === 0) return; // already notified, or lost the race — nothing to do

  const battle = claimed[0];
  if (!battle.votingEndsAt) return; // shouldn't happen for a finished battle, but stay safe

  const [official, brandARows, brandBRows, voters] = await Promise.all([
    getVoteTallyAsOf(battle.id, battle.brandAId, battle.brandBId, battle.votingEndsAt),
    db.select({ name: brands.name }).from(brands).where(eq(brands.id, battle.brandAId)).limit(1),
    db.select({ name: brands.name }).from(brands).where(eq(brands.id, battle.brandBId)).limit(1),
    db.selectDistinct({ userId: votes.userId }).from(votes).where(eq(votes.battleId, battle.id)),
  ]);
  const brandAName = brandARows[0]?.name ?? "Marke A";
  const brandBName = brandBRows[0]?.name ?? "Marke B";

  const title =
    official.brandAVotes === official.brandBVotes
      ? `🤝 Unentschieden: ${brandAName} vs. ${brandBName}`
      : official.brandAVotes > official.brandBVotes
        ? `🏆 ${brandAName} gewinnt gegen ${brandBName}!`
        : `🏆 ${brandBName} gewinnt gegen ${brandAName}!`;
  const body = `Ergebnis: ${official.brandAVotes} : ${official.brandBVotes} — sieh dir den Pitch an.`;
  const url = `/?battle=${battle.id}`;

  await Promise.all(voters.map((v) => sendPushToUser(v.userId, { title, body, url })));
}
