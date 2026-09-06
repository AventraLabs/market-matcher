import { AuthCard } from "@/components/ui";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthCard title="Anmelden" subtitle="Willkommen zurück.">
      <LoginForm />
    </AuthCard>
  );
}
