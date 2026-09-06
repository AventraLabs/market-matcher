"use client";

import { useActionState } from "react";
import { resendVerificationEmail, type FormState } from "@/app/actions/auth";
import { FormSuccess, SubmitButton } from "@/components/ui";

export function ResendVerificationButton() {
  const [state, action] = useActionState<FormState, FormData>(
    () => resendVerificationEmail(),
    undefined,
  );

  return (
    <form action={action}>
      {state?.success && <FormSuccess message="Bestätigungs-E-Mail wurde erneut verschickt." />}
      <SubmitButton>Bestätigungs-E-Mail erneut senden</SubmitButton>
    </form>
  );
}
