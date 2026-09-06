import { AuthCard } from "@/components/ui";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthCard title="Neues Passwort" subtitle="Wähle ein neues Passwort für deinen Account.">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-sm text-red-400">Kein gültiger Link. Bitte fordere einen neuen Reset-Link an.</p>
      )}
    </AuthCard>
  );
}
