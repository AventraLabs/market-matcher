import * as z from "zod";

// Deliberately simple for Phase 1: at least 8 characters, one letter, one
// number. We can tighten this later without touching any call sites.
const passwordSchema = z
  .string()
  .min(8, "Mindestens 8 Zeichen.")
  .regex(/[a-zA-Z]/, "Mindestens ein Buchstabe.")
  .regex(/[0-9]/, "Mindestens eine Zahl.");

// Phase 8: every account is either an Acro (a brand — posts pitches,
// invites, replies) or an Assent (watches and votes, never owns a brand).
// Chosen once at registration; there's no UI to switch later yet.
export const AccountTypes = ["acro", "assent"] as const;

export const RegisterSchema = z.object({
  name: z.string().trim().min(1, "Name fehlt.").max(100).optional().or(z.literal("")),
  email: z.email("Ungültige E-Mail-Adresse.").trim().toLowerCase(),
  password: passwordSchema,
  accountType: z.enum(AccountTypes, "Bitte wähle Acro oder Assent."),
});

export const LoginSchema = z.object({
  email: z.email("Ungültige E-Mail-Adresse.").trim().toLowerCase(),
  password: z.string().min(1, "Passwort fehlt."),
});

export const ForgotPasswordSchema = z.object({
  email: z.email("Ungültige E-Mail-Adresse.").trim().toLowerCase(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Aktuelles Passwort fehlt."),
  newPassword: passwordSchema,
});

// Phase 2: brands. Category list matches the per-category rankings from the
// product spec; kept as a plain string column in the DB so adding one later
// is a code change, not a migration.
export const BrandCategories = [
  "Food",
  "Fashion",
  "Beauty",
  "Tech",
  "Automotive",
  "Gaming",
  "Local Business",
  "Startup",
  "Other",
] as const;

export const BrandCountries = ["AT", "DE", "CH", "Other"] as const;

export const CreateBrandSchema = z.object({
  name: z.string().trim().min(2, "Mindestens 2 Zeichen.").max(80, "Maximal 80 Zeichen."),
  description: z.string().trim().max(500, "Maximal 500 Zeichen.").optional().or(z.literal("")),
  website: z.union([z.url("Ungültige URL (z. B. https://example.com)."), z.literal("")]).optional(),
  category: z.enum(BrandCategories, "Bitte Kategorie wählen."),
  country: z.enum(BrandCountries, "Bitte Land wählen."),
});
