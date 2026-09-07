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

// Phase 4: challenges. Brand A challenges Brand B; Brand B has 24h to
// accept or decline. Expiry is computed at read time (challengeStatus()
// in src/lib/challenge.ts) rather than via a cron job — simpler, and
// correct regardless of how long it's been since anyone looked.
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

// Phase 5: battles. Created automatically the moment a challenge is
// accepted (see respondToChallenge in src/app/actions/challenge.ts) — a
// battle is just "this accepted challenge, viewed as a head-to-head page".
// status stays 'active' through Phase 5; Phase 6 (voting) is what will
// eventually flip it to 'finished'.
export const battles = pgTable(
  "battles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    brandAId: uuid("brand_a_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    brandBId: uuid("brand_b_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("battles_challenge_id_unique_idx").on(table.challengeId)],
);

export type Battle = typeof battles.$inferSelect;
export type NewBattle = typeof battles.$inferInsert;
