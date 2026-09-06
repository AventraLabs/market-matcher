"use client";

import { useActionState } from "react";
import { changePassword, type FormState } from "@/app/actions/auth";
import { Field, FormError, FormSuccess, SubmitButton } from "@/components/ui";

export function ChangePasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePassword, undefined);

  return (
    <form action={action}>
      <FormError message={state?.errors?._form?.[0]} />
      {state?.success && <FormSuccess message="Passwort geändert." />}
      <Field
        label="Aktuelles Passwort"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        errors={state?.errors?.currentPassword}
      />
      <Field
        label="Neues Passwort"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        errors={state?.errors?.newPassword}
      />
      <SubmitButton>Passwort ändern</SubmitButton>
    </form>
  );
}
