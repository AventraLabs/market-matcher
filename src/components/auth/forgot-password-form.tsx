"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type FormState } from "@/app/actions/auth";
import { Field, FormSuccess, SubmitButton } from "@/components/ui";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, undefined);

  if (state?.success) {
    return (
      <FormSuccess message="Falls diese E-Mail-Adresse registriert ist, wurde ein Link zum Zurücksetzen verschickt." />
    );
  }

  return (
    <form action={action}>
      <Field label="E-Mail" name="email" type="email" autoComplete="email" errors={state?.errors?.email} />
      <SubmitButton>Link anfordern</SubmitButton>
      <p className="mt-4 text-center text-sm text-zinc-400">
        <Link href="/login" className="text-orange-500 hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </form>
  );
}
