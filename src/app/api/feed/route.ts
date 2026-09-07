import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/session";
import { getForYouFeed, getFollowingFeed } from "@/lib/feed";

const PAGE_SIZE = 6;

// Route handlers, not Server Actions: the feed scrolls and plays video
// client-side, and a Server Action's refresh() re-renders the whole route's
// server tree — fine for a form, disruptive for an infinite-scroll video
// feed (would reset scroll position / re-fetch everything on every like).
// Plain JSON fetches keep each interaction local to the one card.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") === "following" ? "following" : "foryou";
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);
  const viewer = await getOptionalUser();

  if (tab === "following") {
    if (!viewer) {
      return NextResponse.json({ items: [], total: 0, requiresLogin: true });
    }
    const page = await getFollowingFeed(viewer.id, offset, PAGE_SIZE);
    return NextResponse.json(page);
  }

  const page = await getForYouFeed(viewer?.id ?? null, offset, PAGE_SIZE);
  return NextResponse.json(page);
}
