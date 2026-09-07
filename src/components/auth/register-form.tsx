"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { registerUser, type FormState } from "@/app/actions/auth";
import { Field, FormError, SubmitButton } from "@/components/ui";

type AccountType = "acro" | "assent";

function RoleCard({
  value,
  title,
  description,
  selected,
  onSelect,
}: {
  value: AccountType;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        "flex-1 rounded-lg border p-3 text-left transition-colors " +
        (selected ? "border-orange-500 bg-orange-500/10" : "border-zinc-700 hover:border-zinc-500")
      }
    >
      <p className={"text-sm font-semibold " + (selected ? "text-orange-400" : "text-white")}>{title}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
    </button>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState<FormState, FormData>(registerUser, undefined);
  const [accountType, setAccountType] = useState<AccountType>("assent");

  return (
    <form action={action}>
      <FormError message={state?.errors?._form?.[0]} />

      <div className="mb-4">
        <p className="mb-2 text-sm font-medium text-zinc-300">Wer bist du?</p>
        <input type="hidden" name="accountType" value={accountType} />
        <div className="flex gap-2">
          <RoleCard
            value="acro"
            title="Acro"
            description="Marke — postet Pitches"
            selected={accountType === "acro"}
            onSelect={() => setAccountType("acro")}
          />
          <RoleCard
            value="assent"
            title="Assent"
            description="Schaut zu & stimmt ab"
            selected={accountType === "assent"}
            onSelect={() => setAccountType("assent")}
          />
        </div>
        {state?.errors?.accountType?.map((err) => (
          <p key={err} className="mt-1 text-sm text-red-400">
            {err}
          </p>
        ))}
      </div>

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
