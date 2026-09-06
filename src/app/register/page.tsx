import { AuthCard } from "@/components/ui";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthCard title="Account erstellen" subtitle="Market Matcher — Werbung wird zum Entertainment.">
      <RegisterForm />
    </AuthCard>
  );
}
