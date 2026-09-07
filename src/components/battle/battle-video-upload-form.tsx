"use client";

import { useActionState } from "react";
import { uploadBattleVideo, type UploadBattleVideoFormState } from "@/app/actions/battle";
import { FormError, SubmitButton } from "@/components/ui";

export function BattleVideoUploadForm({ battleId }: { battleId: string }) {
  const [state, action] = useActionState<UploadBattleVideoFormState, FormData>(uploadBattleVideo, undefined);

  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="battleId" value={battleId} />
      <FormError message={state?.error} />
      <input
        id="video"
        name="video"
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        required
        className="mb-3 w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700"
      />
      <SubmitButton>Dein Video hochladen</SubmitButton>
    </form>
  );
}
