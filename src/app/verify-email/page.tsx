import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, emailVerificationTokens } from "@/db/schema";
import { hashToken } from "@/lib/tokens";
import { AuthCard } from "@/components/ui";

async function verify(token: string | undefined) {
  if (!token) return { ok: false, message: "Kein Bestätigungslink angegeben." };

  const tokenHash = hashToken(token);
  const [record] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, tokenHash))
    .limit(1);

  if (!record || record.expiresAt < new Date()) {
    return { ok: false, message: "Der Link ist ungültig oder abgelaufen. Fordere in deinem Profil einen neuen an." };
  }

  await db.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, record.userId));
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, record.userId));

  return { ok: true, message: "Deine E-Mail-Adresse wurde bestätigt." };
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = await verify(token);

  return (
    <AuthCard title="E-Mail-Bestätigung">
      <p className={result.ok ? "text-green-400" : "text-red-400"}>{result.message}</p>
      <Link href={result.ok ? "/profile" : "/login"} className="mt-4 inline-block text-orange-500 hover:underline">
        {result.ok ? "Zum Profil" : "Zur Anmeldung"}
      </Link>
    </AuthCard>
  );
}
