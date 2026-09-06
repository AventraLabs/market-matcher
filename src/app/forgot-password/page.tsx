import { AuthCard } from "@/components/ui";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Passwort vergessen" subtitle="Wir schicken dir einen Link zum Zurücksetzen.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
