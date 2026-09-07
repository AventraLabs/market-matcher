"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { toggleReminder, type ReminderFormState } from "@/app/actions/reminder";

function ToggleButton({ hasReminder }: { hasReminder: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 " +
        (hasReminder
          ? "border border-orange-500/40 bg-orange-500/10 text-orange-400 hover:border-red-500 hover:text-red-400"
          : "border border-zinc-700 text-zinc-300 hover:border-orange-400 hover:text-orange-400")
      }
    >
      {pending ? "…" : hasReminder ? "🔔 Erinnert ✓" : "🔔 Erinnern"}
    </button>
  );
}

export function ReminderButton({ battleId, hasReminder }: { battleId: string; hasReminder: boolean }) {
  const [state, action] = useActionState<ReminderFormState, FormData>(toggleReminder, undefined);

  return (
    <form action={action}>
      <input type="hidden" name="battleId" value={battleId} />
      <ToggleButton hasReminder={hasReminder} />
      {state?.error && <p className="mt-1 text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
