import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
