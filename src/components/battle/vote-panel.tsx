"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { castVote, type VoteFormState } from "@/app/actions/vote";
import type { VoteTally } from "@/lib/vote";

type Side = { id: string; name: string };

function VoteButton({ label, brandId }: { label: string; brandId: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="votedForBrandId"
      value={brandId}
      disabled={pending}
      className="flex-1 rounded-lg bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
    >
      {pending ? "…" : `🏆 ${label}`}
    </button>
  );
}

function ResultBar({
  label,
  brandVotes,
  total,
  isYourVote,
  isLeading,
}: {
  label: string;
  brandVotes: number;
  total: number;
  isYourVote: boolean;
  isLeading: boolean;
}) {
  const pct = total === 0 ? 0 : Math.round((brandVotes / total) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className={isYourVote ? "font-semibold text-orange-400" : "text-white"}>
          {isLeading && "👑 "}
          {label}
          {isYourVote && " · Deine Stimme"}
        </span>
        <span className="text-zinc-400">
          {pct}% ({brandVotes})
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function VotePanel({
  battleId,
  brandA,
  brandB,
  tally,
  userVote,
  canVote,
  isLoggedIn,
}: {
  battleId: string;
  brandA: Side;
  brandB: Side;
  tally: VoteTally;
  userVote: string | null;
  canVote: boolean;
  isLoggedIn: boolean;
}) {
  const [state, action] = useActionState<VoteFormState, FormData>(castVote, undefined);
  const hasVoted = Boolean(userVote);
  const leading =
    tally.brandAVotes === tally.brandBVotes ? null : tally.brandAVotes > tally.brandBVotes ? brandA.id : brandB.id;

  return (
    <div className="mx-auto mt-6 w-full max-w-[380px] rounded-xl border border-zinc-800 p-4">
      <h2 className="mb-3 text-center text-sm font-semibold tracking-wide text-zinc-400">WER HAT GEWONNEN?</h2>

      {hasVoted || !canVote ? (
        <div className="space-y-3">
          <ResultBar
            label={brandA.name}
            brandVotes={tally.brandAVotes}
            total={tally.total}
            isYourVote={userVote === brandA.id}
            isLeading={leading === brandA.id}
          />
          <ResultBar
            label={brandB.name}
            brandVotes={tally.brandBVotes}
            total={tally.total}
            isYourVote={userVote === brandB.id}
            isLeading={leading === brandB.id}
          />
          <p className="text-center text-xs text-zinc-500">
            {tally.total} {tally.total === 1 ? "Stimme" : "Stimmen"}
          </p>
          {!isLoggedIn && (
            <p className="text-center text-sm text-zinc-400">
              <a href="/login" className="text-orange-500 hover:underline">
                Anmelden
              </a>
              , um abzustimmen.
            </p>
          )}
          {isLoggedIn && !canVote && !hasVoted && (
            <p className="text-center text-sm text-zinc-500">Du kannst bei deiner eigenen Marke nicht abstimmen.</p>
          )}
        </div>
      ) : (
        <form action={action}>
          <input type="hidden" name="battleId" value={battleId} />
          {state?.error && <p className="mb-3 text-center text-sm text-red-400">{state.error}</p>}
          <div className="flex gap-3">
            <VoteButton label={brandA.name} brandId={brandA.id} />
            <VoteButton label={brandB.name} brandId={brandB.id} />
          </div>
          {tally.total > 0 && (
            <p className="mt-2 text-center text-xs text-zinc-500">
              {tally.total} {tally.total === 1 ? "Stimme" : "Stimmen"} bisher
            </p>
          )}
        </form>
      )}
    </div>
  );
}
