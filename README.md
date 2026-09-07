# Market Matcher

> Werbung wird zum Entertainment.

Built phase by phase. **Done so far: Phase 1 (accounts), Phase 2 (brands), Phase 3
(video), Phase 4 (challenges), Phase 5 (battle + follow/notify refinements), Phase 6
(voting), Phase 7 (per-battle video, hidden results, open counters).**

**Live:** https://market-matcher-neon.vercel.app

Stack: Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Drizzle ORM · Postgres
(Supabase) · Auth.js v5 (Credentials) · Resend.

Prisma was the originally planned ORM, but its engine binaries can't be downloaded in
this build environment (blocked by network policy), so this project uses Drizzle
instead — pure TypeScript, no binary engine, same relational-Postgres fit.

## 1. Local setup

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL, AUTH_SECRET, APP_URL
npm run db:generate          # only needed after changing src/db/schema.ts
npm run db:migrate           # applies drizzle/*.sql to the database in DATABASE_URL
npm run dev
```

Generate `AUTH_SECRET` with `openssl rand -base64 32`.

Without `RESEND_API_KEY` set, verification and password-reset emails aren't actually
sent — the link is printed to the server console instead (`[email] ... link=...`).
That's enough to test the whole flow solo.

## 2. Data model

`src/db/schema.ts`:

- **users** — id, email (unique), passwordHash, name, emailVerifiedAt, timestamps.
- **email_verification_tokens** / **password_reset_tokens** — single-use, hashed
  (SHA-256) tokens with an expiry (24h / 1h). The raw token only ever exists in the
  emailed link, never stored.
- **brands** — id, name, slug (unique, auto-generated from name), description,
  logoUrl, website, category, country, timestamps.
- **brand_members** — brandId + userId + role. A join table rather than an `ownerId`
  column on `brands`, so adding teams/roles later is additive, not a migration. Phase
  2 enforces one brand per user at the application level (see
  `src/app/actions/brand.ts`) — the schema doesn't stop it, so lifting that limit
  later is a one-line change.
- **brands.videoUrl / videoUploadedAt** — one showcase video per brand (Phase 3). A
  brand's actual battle submissions get their own table once Phase 5 needs it; this
  is just "the video on my public profile" for now.
- **challenges** (Phase 4) — challengerBrandId, challengedBrandId, status
  (pending/accepted/declined/expired), expiresAt (createdAt + `CHALLENGE_WINDOW_MS`,
  2 weeks by default — see Phase 5.1 below), respondedAt, timestamps. Partial unique
  index on (challenger, challenged) WHERE status='pending'.
- **battles** (Phase 5) — challengeId (unique — one battle per accepted challenge),
  brandAId, brandBId, status ('active' for now), createdAt. Still uses each brand's
  `videoUrl` from Phase 3 rather than a separate per-battle submission — that split
  only matters once a brand needs different content per battle, which isn't yet.
- **follows** (Phase 5.1) — userId + brandId, unique per pair. A user following a
  brand, so they can be notified about that brand's next battle.
- **notifications** (Phase 5.1) — userId, message, battleId (nullable), readAt,
  createdAt. In-app only for now — see Phase 5.1 notes below.
- **votes** (Phase 6) — battleId, userId, votedForBrandId, createdAt. Unique index
  on (battleId, userId) — the real enforcement of one vote per user per battle; the
  app also checks first for a friendlier error message.
- **battles** got extended in Phase 7 rather than getting a new table: `mode`
  ('scheduled' | 'open'), `category` (currently always the one constant format —
  see PITCH_CATEGORY in `src/lib/battle-format.ts`), `brandAVideoUrl` /
  `brandBVideoUrl` (per-battle video, replacing the old reuse of the brand's
  profile showcase video), `brandASubmittedAt` / `brandBSubmittedAt`,
  `productionDeadline` (scheduled mode only), `votingEndsAt`. `challengeId` is now
  nullable — an 'open' battle has no challenge behind it. Nothing about a battle's
  current stage (awaiting videos / voting / finished) or winner is stored — it's
  computed at read time from these fields, same philosophy as challenges'
  effectiveStatus(). See `src/lib/battle-stage.ts`.

- **comments** (Phase 8) — battleId, userId, content, createdAt. Flat, no threading —
  a TikTok/Reels-style list under a Pitch, newest first.
- **likes** (Phase 9) — battleId + brandId + userId, unique per triple. A generic
  "like this video" heart, one per user per battle-*side* (a battle has two videos,
  each with its own like count) — deliberately separate from `votes`: a like is a
  free, repeatable reaction, a vote is the one-per-battle "who wins" decision. A
  viewer can like both sides of a Pitch but can only vote for one.

More tables get added in later phases, on top of this.

## 3. What's implemented

**Phase 1 — accounts:**

- `/register` — create account, auto-login, verification email sent.
- `/login`, logout (button on `/profile`).
- `/verify-email?token=...` — confirms the address.
- `/forgot-password` → email with reset link → `/reset-password?token=...`.
- `/profile` — shows account status, "resend verification email", change password.
- `proxy.ts` redirects signed-out users away from `/profile` and signed-in users away
  from `/login` and `/register` (optimistic check; real checks happen server-side in
  `src/lib/session.ts` and the server actions in `src/app/actions/auth.ts`).

**Phase 2 — brands:**

- `/profile` — shows a "Meine Marke" card: the create-brand form if the user has none
  yet, otherwise a link to their brand.
- Create-brand form: name, description, category, country, website, logo upload
  (PNG/JPEG/WEBP/SVG, max 2 MB). One brand per user for now.
- `/brands/[slug]` — public brand profile page (logo, name, category, country,
  description, website). No auth required to view.
- `src/lib/storage.ts` — logo upload, local disk in dev, Supabase Storage in prod (see
  §5). Slug collisions (two brands named the same) get `-2`, `-3`, ... appended.

**Phase 3 — video:**

- `/profile` — once a brand exists, a "Video" card: upload (or replace) a short
  vertical video (MP4/WEBM/MOV, max 50 MB).
- Shows on both `/profile` and the public `/brands/[slug]` page as a 9:16 HTML5
  `<video>` player.
- "Verarbeitung" (processing) for this phase is upload + storage — there's no
  transcoding/thumbnailing pipeline yet (ffmpeg isn't available in a default Vercel
  serverless function), so the pending state during a slow mobile upload *is* the
  processing step for now. Revisit once video needs normalizing for the actual battle
  feed.
- Uses `refresh()` (from `next/cache`, new in Next.js 16) after the upload — Server
  Actions no longer auto-refresh the invoking route's server-rendered data, so without
  it the new video wouldn't show up on `/profile` until a manual reload.

**Phase 4 — challenges:**

- `/brands` — public list of all brands (discovery, so there's something to challenge).
- `/brands/[slug]` — logged-in visitors with their own brand see a "Herausfordern" button
  (hidden on their own brand's page, or once a live challenge already exists between the
  two brands in either direction).
- `/profile` — a "Herausforderungen" card: incoming challenges (with Annehmen/Ablehnen)
  and outgoing challenges (with status).
- 24h window to accept/decline. No cron job — `effectiveStatus()` in `src/lib/challenge.ts`
  computes "expired" from `expiresAt` at read time, so a stale row is correct the moment
  anyone looks, regardless of how long it's been. `respondToChallenge` additionally
  persists the `expired` status the first time someone tries to act on a stale one.
- A partial unique index (`challenges_challenger_challenged_pending_idx`) stops the same
  brand from firing off duplicate *pending* challenges in the same direction at the DB
  level; the opposite-direction and general "already have a live one" checks are
  application-level (`getLivePendingChallengeBetween`).

**Phase 5 — battle:**

- Accepting a challenge (`respondToChallenge`) automatically inserts a row in the new
  `battles` table — a battle is just "this accepted challenge, viewed as a head-to-head
  page". One battle per challenge (unique index on `challenge_id`).
- `/battles` — public list of all battles (brand vs. brand).
- `/battles/[id]` — both brands' showcase videos side by side (9:16 players, stacked on
  mobile via `sm:flex-row`), reachable logged-out. If a brand hasn't uploaded a video
  yet, shows a placeholder instead of a broken player.
- On `/profile`, an accepted challenge's status badge becomes a "Battle ansehen" link
  straight to its battle page (both `getIncomingChallenges`/`getOutgoingChallenges` now
  left-join `battles` on `challenge_id` to get this for free).
- `battles.status` defaults to `'active'` — unused until Phase 6, which is what will
  flip it to `'finished'` once voting closes.

**Phase 5.1 — refinements (product feedback, before Phase 6):**

- **Challenge window extended 24h → 2 weeks.** No brand can shoot a real marketing
  video in a day, and a brand fielding several challenges at once needs even more
  room, not less. `CHALLENGE_WINDOW_MS` in `src/lib/challenge.ts` is the one place
  this is tuned — currently 14 days as a starting assumption. Note: accepting a
  challenge today still immediately creates the battle using each brand's existing
  showcase video (see the `battles` note above) rather than opening a dedicated
  production window per battle — that's the more accurate long-term fix if 2 weeks
  ever turns out to still be too tight, but it's a bigger schema change (per-battle
  video + its own deadline) than today's ask called for, so it's flagged here rather
  than half-built.
- **Follow + notify.** `/brands/[slug]` now shows a follower count and a
  Folgen/Folgt-Button (hidden for your own brand, and for logged-out visitors, who
  still see the count). The moment a challenge is accepted, everyone following
  *either* brand gets an in-app notification ("Battle Cola battelt jetzt gegen
  Battle Fanta!") shown on `/profile`, linking straight to the battle. No
  push/email yet — a follower has to open the app and check `/profile` to see it;
  that's the natural next step once real users are testing this beyond one device.
  A user following both brands in a battle currently gets two notifications rather
  than one merged one — a deliberate rough edge, not a bug.
- **Battle page redesigned as a single-video viewer, not side-by-side.** Two 9:16
  videos next to each other left almost nothing visible on a phone. `/battles/[id]`
  now shows one brand's video at a time (`BattleViewer` in
  `src/components/battle/battle-viewer.tsx`) with a tab bar to flip between the two
  — closer to how people actually watch vertical video, and leaves room for an
  actual swipe gesture later without a data-model change.

**Phase 6 — voting:**

- `/battles/[id]` now has a "WER HAT GEWONNEN?" panel below the video viewer: two
  vote buttons before you've voted, a live percentage bar for each brand (with a 👑
  on whoever's ahead) after you have. One vote per logged-in user per battle,
  enforced by a unique DB index (`src/db/schema.ts`) — `castVote` in
  `src/app/actions/vote.ts` also checks first, for a clean error message instead of
  a raw constraint violation.
- A brand's own team (checked via `brand_members`) can't vote in its own battle —
  otherwise a brand could just vote itself to the top. Logged-out visitors see the
  live tally and a "Anmelden, um abzustimmen" prompt instead of vote buttons.
- **No voting deadline.** `battles.status` stays `'active'` — the tally is live and
  ongoing ("who's ahead right now"), not a poll that closes and locks in a winner.
  That's a deliberate simplification: the original idea of flipping to `'finished'`
  (mentioned in the Phase 5 notes above) would need a real reason to pick a closing
  rule — a fixed season, a per-battle expiry — and nothing in the current product
  called for one yet. Easy to add later without a schema change (`battles.status`
  is already there, just unused).
- `/battles` shows a vote-count badge per battle card, so there's a reason to check
  back on a battle you haven't voted in yet.
- Tested for the classic edge cases: an exact 50/50 split renders as two 50% bars
  with no 👑 on either side (not a crash or a false "leader"), and a single vote
  flips the 👑 correctly once the tie breaks.

**Phase 7 — per-battle video, hidden results, open counters:**

Direct follow-up to product feedback after Phase 6 — three changes, all in
`src/lib/battle-format.ts`, `src/lib/battle-stage.ts`, `src/app/actions/battle.ts`:

- **Real per-battle video, verdeckt.** A 'scheduled' battle (from an accepted
  challenge) no longer reuses each brand's general profile video — it starts with
  neither video, `productionDeadline` 2 weeks out, and is invisible/unvotable
  (`awaiting_videos` stage) until **both** brands have uploaded their own video for
  *this* battle via `uploadBattleVideo`. Neither side can see or react to the
  other's video before posting their own. If the deadline passes with only one
  side in, that side wins by walkover; if neither delivered, the battle is simply
  never contested (no winner) — no separate "cancelled" state needed, both are
  just computed outcomes of `getBattleStage()`.
- **Results hidden until voting closes.** The moment both videos are in,
  `votingEndsAt` is set (now + `VOTING_WINDOW_MS`, 1 week) and voting opens — but
  `VotePanel` only shows the total vote count during that week, never the split or
  a leader. This is deliberate: showing the live split risks a bandwagon effect
  (people stop voting for whoever's already behind), which defeats the point of a
  real week-long contest. The total count still shows for FOMO/social proof
  ("340 Stimmen abgegeben"). The split, the 👑, and the winner only appear once
  `votingEndsAt` has passed.
- **Open counters — no permission needed.** Any brand can react to another
  brand's public showcase video with their own, no challenge/accept step —
  `counterWithVideo` in `src/app/actions/battle.ts`, triggered by a "⚔️ Kontern"
  button on `/brands/[slug]`. This exists specifically so a brand nobody has
  challenged (a new startup, say) isn't stuck waiting to be picked — it can jump
  into a battle on its own initiative, the same way anyone can duet/stitch a
  TikTok without asking. The countered video is copied into the new battle at the
  moment of countering (not live-referenced), so it can't shift under an ongoing
  battle if the original brand later replaces their profile video. Both videos
  exist the instant the battle is created, so an 'open' battle skips
  `awaiting_videos` entirely and goes straight to `voting`.
- The "battle is live, vote now" follower notification (from Phase 5.1) now fires
  when both videos actually land — `activateBattleIfBothSidesReady()` — not at
  challenge-acceptance, since acceptance no longer means anything is watchable yet.
- **Known rough edge:** battles created before this phase have no
  `productionDeadline`/`votingEndsAt` and fall back to each brand's profile video
  (`resolveBattleVideos()` in `src/lib/battle.ts`) so they don't just break — but
  since nothing ever sets `votingEndsAt` for them, they stay in a perpetually-open
  "voting" stage (never reaching a revealed result) rather than being backfilled.
  Harmless for the handful of test battles that predate this migration; not a
  concern for anything created from here on.

Deliberately out of scope: any ranking/ELO across battles, and a category picker
(there's one fixed category for now — see `PITCH_CATEGORY`).

**Phase 8 — roles (Acro/Assent) and a friendlier vocabulary:**

Product feedback: "Battle/Herausfordern/Kontern" reads as combat, not as a stage for
the best marketing pitch, and every user was implicitly a brand — there was no way to
just watch and vote without also being able to post. Two changes, both purely
additive (no battle-stage logic touched):

- **Roles.** `users.accountType` is `'acro'` (a brand — posts pitches, invites,
  replies) or `'assent'` (watches, follows, votes — can never own a brand). Chosen
  once at registration (`RegisterForm`'s role picker), no UI to switch later yet.
  The only enforcement point is `createBrand` (`src/app/actions/brand.ts`) — every
  other Acro-only action already requires a brand via `getBrandForUser`, so gating
  brand creation gates everything downstream for free. Existing accounts were
  backfilled by the migration: anyone already in `brand_members` became `'acro'`,
  everyone else `'assent'`.
- **Renamed UI vocabulary** (internal code — table/column names, `battle.ts`,
  `/app/actions/battle.ts`, etc. — deliberately untouched, this was a copy + routing
  pass, not a rewrite):
  - "Battle" → **Pitch**. `/battles` and `/battles/[id]` are now `/pitches` and
    `/pitches/[id]`.
  - "Herausfordern" (challenge) → **Einladen** (invite). "Annehmen"/"Ablehnen"
    (accept/decline) are unchanged.
  - "Kontern" (counter) → **Antworten** (reply) — the ⚔️ is gone.
  - Earlier phase notes above still say "Herausfordern"/"Battle"/"Kontern" since
    that's what the UI said when each phase shipped — this section is the one place
    documenting the rename itself.
- **Comments.** A flat, TikTok/Reels-style comment thread under every Pitch
  (`comments` table, `src/lib/comment.ts`, `src/app/actions/comment.ts`,
  `CommentSection` component) — newest first, anyone signed in can post (Acro or
  Assent, including a Pitch's own brands), visible at every stage including
  `awaiting_videos`. No edit/delete UI yet, no nested replies — a known rough edge,
  not a blocker for testing whether comments add anything.

**Phase 9 — the feed (TikTok/Reels-style, the new home screen):**

Product direction, verbatim: make the home screen a real full-screen, vertically-
scrolling video feed — "das wird die Revolution", "so wie man es kennt" — with the
standard social actions (Like, Comment, Share) plus voting worked in wherever a
video belongs to a Pitch, and a way to see both what's trending and what brands you
follow just posted.

- **`/` *is* the feed now**, for everyone, logged in or not (`src/app/page.tsx` →
  `FeedClient`). One full-screen video per swipe, scroll-snap (`snap-y
  snap-mandatory` + `snap-start snap-always`), autoplay/pause driven by a per-card
  `IntersectionObserver` (plays once ≥60% visible, pauses otherwise — no shared
  "one video at a time" coordinator needed since scroll-snap already guarantees
  only one card is ever mostly-visible at a time). Tap a video to mute/unmute (starts
  muted, autoplay-safe). Register/login now redirect to `/` instead of `/profile`.
- **One card per battle *side*, not per battle.** "Das Video ist der ganze
  Bildschirm" — a battle has two videos, so it produces two feed cards, each full-
  screen, each with its own like count. A card only exists once both sides of its
  battle are actually visible under the existing Phase 7 "hidden results" rule
  (`stage.stage === "voting"` or `"finished"`/`"voted"`) — nothing pre-reveal, no
  walkover/no-show, ever shows up in the feed. `src/lib/feed.ts` is the query
  layer; `getForYouFeed`/`getFollowingFeed`.
- **Two tabs**, mirroring TikTok's own For You/Following split — the product ask
  ("Trending oder For You oder was Neues" + "gefolgte Firmen posten neue Pitches")
  collapses cleanly into exactly this:
  - **Für dich** — every live/finished Pitch, ranked by a *live-computed* trending
    score (`trendingScore()` in `src/lib/feed.ts`) — engagement (likes + 1.5×
    comments + 2× votes) divided by a recency decay. Not persisted or cached, same
    philosophy as `getBattleStage()`/`effectiveStatus()` elsewhere in this app:
    recompute from current counts every time rather than let a cached rank drift.
    Fine at today's scale; revisit if it ever stops being cheap.
  - **Folge ich** — only cards from brands the viewer follows
    (`getFollowedBrandIds()`, new in `src/lib/follow.ts`), newest first. Empty state
    prompts to follow brands (or log in, if logged out) — this is also the tab that
    answers "did a brand I follow just post something".
  - A `FollowButton` sits right on each feed card next to the brand name, so
    discovering a brand in "Für dich" and following it happens without leaving the
    feed.
- **Like** — a heart, independent of voting (`likes` table above). Optimistic on
  tap, backed by `POST /api/feed/like`.
- **Comment** — opens a bottom sheet (`CommentSheet`) over the feed reusing the
  same `comments` table/thread as the `/pitches/[id]` page — post from either
  place, see it in both.
- **Vote** — a single button per card, "🏆 Für {brand} stimmen", since a feed card
  only shows one side at a time (you'd scroll to the other card to vote for the
  opponent instead). Same rules as `/pitches/[id]`'s vote panel, same hidden-until-
  finished split — `castVoteForUser()` in `src/lib/vote.ts` is now the one shared
  implementation both the Pitch page's form action and the feed's vote API call
  into (a small refactor, not a behavior change).
- **Share** — deliberately scoped down to a real share link (native
  `navigator.share()`, clipboard-copy fallback), not an in-app "send to a friend"
  DM — that would need a whole friends/messaging system this phase didn't call
  for. The link points at `/pitches/[id]`, which already shows the full pitch
  (both sides, vote panel, comments).
- **Why route handlers, not Server Actions, for like/vote/comment here.** Every
  other write in this app so far is a Server Action ending in `refresh()` — fine
  for a form on an otherwise-static page, wrong for an infinite-scroll video feed,
  where re-rendering the whole route on every tap would reset scroll position and
  interrupt playback. `/api/feed`, `/api/feed/like`, `/api/feed/vote`,
  `/api/feed/comments` are plain JSON route handlers instead; the feed client
  patches its own local state after each response.
- **A persistent bottom nav** (`src/components/nav/bottom-nav.tsx`, mounted in
  `src/app/layout.tsx`) — Feed / Pitches / Marken / Profil-or-Anmelden — floats
  over the feed the same way TikTok's own nav does, and sits below the normal
  page padding (`py-16`) everywhere else.
- **Deliberately out of scope:** an in-app friends/DM system for "Teilen" (see
  above), any persisted/cached trending score, and video transcoding/thumbnailing
  (unchanged from Phase 3 — still relying on the browser's own `<video>` decoding).

## 4. The two-real-inboxes test

This is the test described for Phase 1 — two different people, two real inboxes,
against the deployed app:

1. Account A signs up with their email, Account B (a second real person) signs up
   with theirs.
2. Both receive a verification email and confirm.
3. Account A clicks "Passwort vergessen", gets a reset email, sets a new password,
   logs in with it.

For this to work with two different real inboxes, Resend needs a verified sending
domain (see below) — until then, only the Resend account owner's own address can
receive mail, and everyone else's flow has to be tested via the printed console link.

## 5. Deploying

### Supabase (database)

1. Create a project at supabase.com.
2. Project Settings → Database → Connection string → copy the **Transaction
   pooler** URL (port 6543) — required for Vercel's serverless functions.
3. Set that as `DATABASE_URL` (locally in `.env.local`, and in Vercel's env vars).
4. Run `npm run db:migrate` once against that URL (from your machine, with
   `DATABASE_URL` pointed at Supabase) to create the tables.

### Vercel (hosting)

1. Push this repo to GitHub (see below), then import it at vercel.com/new.
2. Add environment variables: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` (your
   `https://<project>.vercel.app` URL, or custom domain), `RESEND_API_KEY`,
   `EMAIL_FROM`.
3. Deploy. Vercel builds and runs `next build` automatically.

### Resend (email) — and the domain question

Without a verified domain, Resend's shared `onboarding@resend.dev` sender can only
deliver to the **Resend account's own email address** — not to any other inbox. This
is a Resend restriction, not something this app can work around in code.

To actually email two different people (the Phase 1 test), verify a domain in
Resend:

1. resend.com → Domains → Add Domain.
2. Add the DNS records it gives you at your domain registrar.
3. Once verified, set `EMAIL_FROM="Market Matcher <noreply@yourdomain.com>"` in
   Vercel's env vars.

If there's no domain yet, everything still works end-to-end via the server-log
fallback — every email is printed to Vercel's function logs regardless of whether
Resend is configured, so links can be copied from there while testing.

### Supabase Storage (brand logos) — optional until deployed

Without it, uploaded logos are written to the local filesystem
(`public/uploads/...`), which is fine for local dev but doesn't persist on Vercel
(its filesystem is ephemeral/read-only outside `/tmp`). To make logo uploads work in
production:

1. Supabase dashboard → Storage → New bucket → name it `public-media`, make it
   **public**.
2. Project Settings → API → copy the **Project URL** and the **service_role** key
   (not the anon key — uploads need write access).
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel's env vars. Leaving
   them unset just keeps using the local-disk fallback, which is harmless in dev.

## 6. Repo

https://github.com/AventraLabs/market-matcher
