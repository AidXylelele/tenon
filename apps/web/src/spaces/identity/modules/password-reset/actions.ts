"use server";

import { redirect } from "next/navigation";
import { completeRecovery } from "@/libs/data-access/identity";
import { type FormState, refusalOf } from "@/libs/forms/form-state";
import { signInHref } from "@/libs/routing/routes";
import { ResetFields } from "./form";

export async function resetPasswordAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const fields = Object.fromEntries(form);
  const parsed = ResetFields.safeParse(fields);

  if (!parsed.success) return refusalOf(parsed.error);

  const outcome = await completeRecovery(
    parsed.data.token,
    parsed.data.password,
  );

  if (!outcome.ok) return { problem: outcome.problem, done: false, values: {} };

  const signIn = signInHref({ reason: "password-set" });
  redirect(signIn);
}
