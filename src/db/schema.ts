import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Phase 1: just what real authentication needs.
// More tables (Brand, Battle, Vote, ...) get added in later phases.

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name"),
    // Phase 8: 'acro' (a brand — posts videos, invites, replies) or
    // 'assent' (watches and votes, can never own a brand). Chosen once at
    // registration, not changeable from the UI yet. Existing rows get
    // backfilled by the migration: anyone already in brand_members becomes
    // 'acro', everyone else 'assent' — see drizzle/ for the backfill UPDATE.
    accountType: text("account_type").notNull().default("assent"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique_idx").on(table.email)],
);

// Single-use token for confirming an email address.
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // We store a SHA-256 hash of the token, never the raw value.
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Single-use token for resetting a forgotten password.
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Phase 2: brands. Kept intentionally small — one owner per brand for now.
// brandMembers exists as its own table (rather than an ownerId column on
// brands) so that adding teams/roles later is additive, not a migration.

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
    website: text("website"),
    category: text("category").notNull(),
    country: text("country").notNull(),
    // Phase 3: one showcase video per brand for now. A brand's actual
    // battle submissions get their own table once Phase 4/5 need it — this
    // column is just "the video on my public profile".
    videoUrl: text("video_url"),
    videoUploadedAt: timestamp("video_uploaded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("brands_slug_unique_idx").on(table.slug)],
);

export const brandMembers = pgTable(
  "brand_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("brand_members_brand_user_unique_idx").on(table.brandId, table.userId)],
);

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;

// Phase 4: challenges. Brand A challenges Brand B; Brand B has a window to
// accept or decline (see CHALLENGE_WINDOW_MS in src/lib/challenge.ts — 2
// weeks by default, long enough to actually produce a video). Expiry is
// computed at read time (effectiveStatus() in src/lib/challenge.ts) rather
// than via a cron job — simpler, and correct regardless of how long it's
// been since anyone looked.
export const challenges = pgTable(
  "challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengerBrandId: uuid("challenger_brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    challengedBrandId: uuid("challenged_brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    // 'pending' | 'accepted' | 'declined' — expiry is derived, not stored,
    // except we flip a pending row to 'expired' the next time it's touched
    // (respondToChallenge) so a stale row doesn't look actionable forever.
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("challenges_challenger_challenged_pending_idx")
      .on(table.challengerBrandId, table.challengedBrandId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export type Challenge = typeof challenges.$inferSelect;
export type NewChallenge = typeof challenges.$inferInsert;

// Phase 5/7: battles. Two ways a battle gets created (see
// src/lib/battle-format.ts for the shared constants and
// src/lib/battle-stage.ts for how the fields below combine into a single
// computed "stage"):
//
// 1. 'scheduled' — a challenge gets accepted (src/app/actions/challenge.ts).
//    challengeId is set, both video columns start empty, productionDeadline
//    is 2 weeks out. Nothing is visible/votable until BOTH brands upload
//    their own video for THIS battle — that's what "verdeckt" means: nobody
//    can see (or copy) the other side's video before posting their own.
// 2. 'open' — a brand's already-public showcase video (brands.videoUrl)
//    gets countered by another brand, no permission needed (Phase 7 —
//    src/app/actions/battle.ts, counterWithVideo). challengeId is null,
//    both video columns are filled at creation (the original video is
//    copied in, not live-referenced, so it can't shift under an ongoing
//    battle), productionDeadline is null since there's nothing to wait for.
//
// Either way, the moment both video columns are filled, votingEndsAt gets
// set (now + VOTING_WINDOW_MS) — that's the actual "battle is live, vote
// now" moment, and it's what the follower notification fires on (see
// activateBattleIfBothSidesReady in src/lib/battle-stage.ts), not challenge
// acceptance or the open-mode counter itself.
//
// status/winner/resolution are NOT stored — src/lib/battle-stage.ts derives
// "awaiting_videos" / "voting" / "finished" (+ winner, +
// walkover-vs-voted-vs-no-show) from these timestamps at read time, same
// philosophy as challenges' effectiveStatus(). The old `status` column
// stays for backward compatibility but is otherwise unused.
export const battles = pgTable(
  "battles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id").references(() => challenges.id, { onDelete: "cascade" }),
    brandAId: uuid("brand_a_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    brandBId: uuid("brand_b_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    // 'scheduled' | 'open'
    mode: text("mode").notNull().default("scheduled"),
    // Free text for now — there's only one category platform-wide today
    // (see PITCH_CATEGORY in src/lib/battle-format.ts), stored per-row so a
    // future "pick a category" feature doesn't need a migration. The
    // column-level default (kept in sync with PITCH_CATEGORY by hand, since
    // schema.ts can't import from a module that itself has no DB
    // dependency without risking a circular import) exists only so this
    // migration doesn't fail on the rows that already exist — every actual
    // insert always passes it explicitly.
    category: text("category").notNull().default("Verkaufe dein Produkt oder deine Leistung in 15 Sekunden"),
    brandAVideoUrl: text("brand_a_video_url"),
    brandBVideoUrl: text("brand_b_video_url"),
    brandASubmittedAt: timestamp("brand_a_submitted_at", { withTimezone: true }),
    brandBSubmittedAt: timestamp("brand_b_submitted_at", { withTimezone: true }),
    productionDeadline: timestamp("production_deadline", { withTimezone: true }),
    votingEndsAt: timestamp("voting_ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Phase 12: set the first time the "result is in" push notification has
    // been sent to this battle's voters — see finalizeAndNotifyBattle() in
    // src/lib/battle-notify.ts. Doubles as the concurrency guard: the update
    // that sets this column is conditioned on it still being NULL, so if two
    // requests race to finalize the same battle (plausible — this fires from
    // ordinary feed reads, not a cron job), only one actually sends pushes.
    resultNotifiedAt: timestamp("result_notified_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("battles_challenge_id_unique_idx").on(table.challengeId)],
);

export type Battle = typeof battles.$inferSelect;
export type NewBattle = typeof battles.$inferInsert;

// Phase 5.1: follows. A user follows a brand to get notified when that
// brand's next battle kicks off — separate from brand_members, which is
// about who *runs* a brand, not who watches it.
export const follows = pgTable(
  "follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("follows_user_brand_unique_idx").on(table.userId, table.brandId)],
);

export type Follow = typeof follows.$inferSelect;
export type NewFollow = typeof follows.$inferInsert;

// Phase 5.1: notifications. In-app only for now (no push/email infra for
// this yet — see README). Created for every follower of either brand the
// moment a challenge is accepted, so "someone I follow is about to battle"
// doesn't require anyone to keep checking back.
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  battleId: uuid("battle_id").references(() => battles.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

// Phase 6: votes. One vote per user per battle (unique index below is what
// actually enforces that — the app checks first for a friendly error, but
// the constraint is the real backstop). No voting deadline for now: the
// tally is just live and ongoing, "who's ahead right now" rather than a
// closed poll — battles.status stays 'active' until a future phase gives a
// concrete reason to close voting (a season, a fixed window, etc.).
export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    battleId: uuid("battle_id")
      .notNull()
      .references(() => battles.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    votedForBrandId: uuid("voted_for_brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("votes_battle_user_unique_idx").on(table.battleId, table.userId)],
);

export type Vote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;

// Phase 8: comments. Flat, TikTok/Reels-style list under a Pitch — no
// threading/replies-to-comments yet, and no edit/delete UI (a known rough
// edge, see README). Anyone signed in can comment, including a Pitch's own
// Acros — this is a discussion thread, not a vote, so there's no
// self-comment restriction like there is for votes.
export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  battleId: uuid("battle_id")
    .notNull()
    .references(() => battles.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

// Phase 9: likes. A generic "like this video" heart, one per user per
// battle-side (battleId + brandId identifies exactly one card in the
// feed — a battle has two sides, each with its own video and its own like
// count). Deliberately separate from `votes`: a like is a free, repeatable-
// per-video reaction like TikTok's heart, a vote is the one-per-battle
// "who wins this Pitch" decision — a viewer can like both sides but can
// only vote for one.
export const likes = pgTable(
  "likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    battleId: uuid("battle_id")
      .notNull()
      .references(() => battles.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("likes_battle_brand_user_unique_idx").on(table.battleId, table.brandId, table.userId)],
);

export type Like = typeof likes.$inferSelect;
export type NewLike = typeof likes.$inferInsert;

// Phase 10: battle reminders. "Erinnere mich" on an upcoming (not-yet-live)
// Pitch in the reframed /pitches list — deliberately separate from
// `follows`: a reminder is set on one specific matchup, not on a brand, so
// it also works for a Pitch between two brands you don't otherwise follow.
// The moment a battle goes live (activateBattleIfBothSidesReady), everyone
// who set a reminder gets a notification too — see battle-stage.ts.
export const battleReminders = pgTable(
  "battle_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    battleId: uuid("battle_id")
      .notNull()
      .references(() => battles.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("battle_reminders_battle_user_unique_idx").on(table.battleId, table.userId)],
);

export type BattleReminder = typeof battleReminders.$inferSelect;
export type NewBattleReminder = typeof battleReminders.$inferInsert;

// Phase 12: web push subscriptions. One row per browser/device a user has
// granted notification permission on (a user can have several — phone +
// laptop). `endpoint` is unique per browser subscription and doubles as the
// natural upsert key (re-subscribing the same browser replaces its keys
// rather than duplicating the row). Used today specifically to tell a voter
// the moment their Pitch's result is in — see src/lib/battle-notify.ts — not
// yet a general notification-preferences system.
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("push_subscriptions_endpoint_unique_idx").on(table.endpoint)]);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
