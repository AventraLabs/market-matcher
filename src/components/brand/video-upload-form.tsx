"use client";

import { useActionState } from "react";
import { uploadBrandVideo, type VideoFormState } from "@/app/actions/video";
import { FormError, FormSuccess, SubmitButton } from "@/components/ui";

export function VideoUploadForm({ hasVideo }: { hasVideo: boolean }) {
  const [state, action] = useActionState<VideoFormState, FormData>(uploadBrandVideo, undefined);

  return (
    <form action={action}>
      <FormError message={state?.errors?._form?.[0] ?? state?.errors?.video?.[0]} />
      {state?.success && <FormSuccess message="Video hochgeladen." />}
      <input
        id="video"
        name="video"
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        required
        className="mb-3 w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700"
      />
      <SubmitButton>{hasVideo ? "Video ersetzen" : "Video hochladen"}</SubmitButton>
    </form>
  );
}
