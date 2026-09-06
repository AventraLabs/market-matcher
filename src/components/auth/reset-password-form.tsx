"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword, type FormState } from "@/app/actions/auth";
import { Field, FormError, FormSuccess, SubmitButton } from "@/components/ui";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(resetPassword, undefined);

  if (state?.success) {
    return (
      <>
        <FormSuccess message="Dein Passwort wurde geändert." />
        <Link href="/login" className="text-orange-500 hover:underline">
          Jetzt anmelden
        </Link>
      </>
    );
  }

  return (
    <form action={action}>
      <FormError message={state?.errors?._form?.[0]} />
      <input type="hidden" name="token" value={token} />
      <Field
        label="Neues Passwort"
        name="password"
        type="password"
        autoComplete="new-password"
        errors={state?.errors?.password}
      />
      <SubmitButton>Passwort ändern</SubmitButton>
    </form>
  );
}
