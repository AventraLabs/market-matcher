"use client";

import { useState } from "react";
import { useActionState } from "react";
import { counterWithVideo, type CounterFormState } from "@/app/actions/battle";
import { FormError, SubmitButton } from "@/components/ui";

export function CounterForm({ targetBrandId }: { targetBrandId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<CounterFormState, FormData>(counterWithVideo, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-orange-500/40 px-4 py-2 text-sm font-semibold text-orange-400 transition-colors hover:bg-orange-500/10"
      >
        Antworten
      </button>
    );
  }

  return (
    <form action={action} className="mt-4 rounded-lg border border-zinc-800 p-4">
      <input type="hidden" name="targetBrandId" value={targetBrandId} />
      <p className="mb-3 text-sm text-zinc-400">
        Lade dein eigenes Video hoch — sobald es hochgeladen ist, entsteht sofort ein Pitch und alle können
        abstimmen.
      </p>
      <FormError message={state?.error} />
      <input
        id="video"
        name="video"
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        required
        className="mb-3 w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700"
      />
      <div className="flex gap-2">
        <SubmitButton>Antworten & Pitch starten</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
