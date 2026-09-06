"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  errors,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  errors?: string[];
  required?: boolean;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-zinc-300">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 outline-none focus:border-orange-500"
      />
      {errors?.map((err) => (
        <p key={err} className="mt-1 text-sm text-red-400">
          {err}
        </p>
      ))}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{message}</p>;
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">{message}</p>;
}

export function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
    >
      {pending ? "…" : children}
    </button>
  );
}
