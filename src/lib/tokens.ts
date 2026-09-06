import { randomBytes, createHash } from "crypto";

/**
 * Verification and reset links carry a random, unguessable token. We only
 * ever store a SHA-256 hash of it — if the tokens table ever leaked, the
 * raw tokens (and therefore the links) still couldn't be reconstructed.
 */
export function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function expiresInHours(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
