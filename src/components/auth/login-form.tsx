"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginUser, type FormState } from "@/app/actions/auth";
import { Field, FormError, SubmitButton } from "@/components/ui";

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(loginUser, undefined);

  return (
    <form action={action}>
      <FormError message={state?.errors?._form?.[0]} />
      <Field label="E-Mail" name="email" type="email" autoComplete="email" errors={state?.errors?.email} />
      <Field
        label="Passwort"
        name="password"
        type="password"
        autoComplete="current-password"
        errors={state?.errors?.password}
      />
      <div className="mb-4 text-right text-sm">
        <Link href="/forgot-password" className="text-zinc-400 hover:text-orange-500 hover:underline">
          Passwort vergessen?
        </Link>
      </div>
      <SubmitButton>Anmelden</SubmitButton>
      <p className="mt-4 text-center text-sm text-zinc-400">
        Noch keinen Account?{" "}
        <Link href="/register" className="text-orange-500 hover:underline">
          Registrieren
        </Link>
      </p>
    </form>
  );
}
