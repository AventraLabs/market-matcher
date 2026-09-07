"use client";

import { useState } from "react";
import { subscribeToPush } from "@/lib/push-client";

/**
 * Phase 12: shown once, right after a viewer's first vote in a session —
 * that's the exact moment "tell me when the result is in" is the most
 * obviously useful thing to ask for. Dismissing (either button, or the ✕)
 * sets a localStorage flag so it never nags again regardless of outcome —
 * this is a one-time offer, not a recurring interruption.
 */
export function PushOptIn({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = useState<"idle" | "asking" | "denied">("idle");

  function dismiss() {
    try {
      localStorage.setItem("mm_push_prompted", "1");
    } catch {
      // localStorage can throw in private-browsing contexts — irrelevant here, just skip remembering.
    }
    onDone();
  }

  async function handleAccept() {
    setStatus("asking");
    const ok = await subscribeToPush();
    if (!ok) {
      setStatus("denied");
      setTimeout(dismiss, 1800);
      return;
    }
    dismiss();
  }

  return (
    <div className="pointer-events-auto absolute inset-x-4 bottom-24 z-30 rounded-xl border border-zinc-700 bg-zinc-900/95 p-4 shadow-lg backdrop-blur">
      {status === "denied" ? (
        <p className="text-center text-sm text-zinc-400">Kein Problem — du kannst das Ergebnis auch einfach im Feed sehen.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-white">🔔 Bescheid sagen, sobald das Ergebnis von diesem Pitch feststeht?</p>
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              disabled={status === "asking"}
              className="flex-1 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
            >
              {status === "asking" ? "…" : "Ja, gerne"}
            </button>
            <button onClick={dismiss} className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500">
              Nein danke
            </button>
          </div>
        </>
      )}
    </div>
  );
}
