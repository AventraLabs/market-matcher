import { getOptionalUser } from "@/lib/session";
import { getForYouFeed } from "@/lib/feed";
import { FeedClient } from "@/components/feed/feed-client";

// Phase 9: the home screen IS the feed now — full-screen, scrollable,
// TikTok/Reels-style. Always live data (never prerendered), same reason as
// /pitches and /brands: a new Pitch or like should show up without a
// redeploy, and getOptionalUser() already makes this dynamic anyway.
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getOptionalUser();
  const firstPage = await getForYouFeed(user?.id ?? null, 0, 6);

  return <FeedClient initialItems={firstPage.items} initialTotal={firstPage.total} isLoggedIn={Boolean(user)} />;
}
