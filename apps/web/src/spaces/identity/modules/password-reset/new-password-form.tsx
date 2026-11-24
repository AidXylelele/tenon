"use client";

import { useActionState } from "react";
import { IDLE } from "@/libs/forms/form-state";
import { ProblemMessage } from "@/libs/ui/composites/problem-message";
import { SubmitButton } from "@/libs/ui/composites/submit-button";
import { NewPasswordField } from "@/features/new-password-field";
import { resetPasswordAction } from "./actions";

export function NewPasswordForm({ token }: { readonly token: string }) {
  const [state, action] = useActionState(resetPasswordAction, IDLE);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <ProblemMessage problem={state.problem} />
      <NewPasswordField name="password" label="New password" autoFocus />
      <SubmitButton size="lg" pendingLabel="Saving…">
        Set password
      </SubmitButton>
    </form>
  );
}
