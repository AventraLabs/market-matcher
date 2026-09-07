import { getOptionalUser } from "@/lib/session";
import { getForYouFeed, getFeedDuelById } from "@/lib/feed";
import { FeedClient } from "@/components/feed/feed-client";

// Phase 9: the home screen IS the feed now — full-screen, scrollable,
// TikTok/Reels-style. Always live data (never prerendered), same reason as
// /pitches and /brands: a new Pitch or like should show up without a
// redeploy, and getOptionalUser() already makes this dynamic anyway.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ battle?: string }> }) {
  const { battle: focusBattleId } = await searchParams;
  const user = await getOptionalUser();
  const firstPage = await getForYouFeed(user?.id ?? null, 0, 6);

  // Phase 10: a link from the notifications screen (or a reminder that just
  // went live) opens the Feed already scrolled to that one Pitch — if it
  // didn't happen to land on page 1 of the trending order, fetch it
  // directly and splice it in so FeedClient always has it to scroll to.
  let items = firstPage.items;
  if (focusBattleId && !items.some((d) => d.battleId === focusBattleId)) {
    const focusDuel = await getFeedDuelById(user?.id ?? null, focusBattleId);
    if (focusDuel) items = [focusDuel, ...items];
  }

  return (
    <FeedClient
      initialItems={items}
      initialTotal={firstPage.total}
      isLoggedIn={Boolean(user)}
      focusBattleId={focusBattleId ?? null}
    />
  );
}
