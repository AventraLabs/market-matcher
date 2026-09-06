"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerUser, type FormState } from "@/app/actions/auth";
import { Field, FormError, SubmitButton } from "@/components/ui";

export function RegisterForm() {
  const [state, action] = useActionState<FormState, FormData>(registerUser, undefined);

  return (
    <form action={action}>
      <FormError message={state?.errors?._form?.[0]} />
      <Field label="Name (optional)" name="name" required={false} errors={state?.errors?.name} />
      <Field label="E-Mail" name="email" type="email" autoComplete="email" errors={state?.errors?.email} />
      <Field
        label="Passwort"
        name="password"
        type="password"
        autoComplete="new-password"
        errors={state?.errors?.password}
      />
      <SubmitButton>Account erstellen</SubmitButton>
      <p className="mt-4 text-center text-sm text-zinc-400">
        Schon registriert?{" "}
        <Link href="/login" className="text-orange-500 hover:underline">
          Anmelden
        </Link>
      </p>
    </form>
  );
}
