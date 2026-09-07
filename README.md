# Market Matcher

> Werbung wird zum Entertainment.

Built phase by phase. **Done so far: Phase 1 (accounts), Phase 2 (brands), Phase 3
(video), Phase 4 (challenges), Phase 5 (battle).**

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
  (pending/accepted/declined/expired), expiresAt (createdAt + 24h), respondedAt,
  timestamps. Partial unique index on (challenger, challenged) WHERE status='pending'.
- **battles** (Phase 5) — challengeId (unique — one battle per accepted challenge),
  brandAId, brandBId, status ('active' for now), createdAt. Still uses each brand's
  `videoUrl` from Phase 3 rather than a separate per-battle submission — that split
  only matters once a brand needs different content per battle, which isn't yet.

More tables (Vote, ...) get added in later phases, on top of this.

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

Deliberately out of scope so far: voting itself (Phase 6) and any ranking/ELO.

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
