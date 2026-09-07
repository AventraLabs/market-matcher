"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { toggleFollow, type FollowFormState } from "@/app/actions/follow";

function ToggleButton({ isFollowing }: { isFollowing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        "rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 " +
        (isFollowing
          ? "border border-zinc-700 text-zinc-300 hover:border-red-500 hover:text-red-400"
          : "bg-orange-600 text-white hover:bg-orange-500")
      }
    >
      {pending ? "…" : isFollowing ? "Folgt ✓" : "Folgen"}
    </button>
  );
}

export function FollowButton({ brandId, isFollowing }: { brandId: string; isFollowing: boolean }) {
  const [state, action] = useActionState<FollowFormState, FormData>(toggleFollow, undefined);

  return (
    <form action={action}>
      <input type="hidden" name="brandId" value={brandId} />
      <ToggleButton isFollowing={isFollowing} />
      {state?.error && <p className="mt-2 text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
