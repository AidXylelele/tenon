"use server";

import { requestRecovery } from "@/libs/data-access/identity";
import { type FormState, refusalOf } from "@/libs/forms/form-state";
import { RecoveryFields } from "./form";

export async function requestRecoveryAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const fields = Object.fromEntries(form);
  const parsed = RecoveryFields.safeParse(fields);

  if (!parsed.success) return refusalOf(parsed.error);

  const email = parsed.data.email;
  const outcome = await requestRecovery(email);

  if (!outcome.ok)
    return { problem: outcome.problem, done: false, values: { email } };

  return { problem: null, done: true, values: { email } };
}
