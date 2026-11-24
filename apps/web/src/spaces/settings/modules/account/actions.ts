"use server";

import { changePassword } from "@/libs/data-access/identity";
import { type FormState, refusalOf } from "@/libs/forms/form-state";
import { PasswordChangeFields } from "./form";

export async function changePasswordAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const fields = Object.fromEntries(form);
  const parsed = PasswordChangeFields.safeParse(fields);

  if (!parsed.success) return refusalOf(parsed.error);

  const outcome = await changePassword(
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );

  if (!outcome.ok) return { problem: outcome.problem, done: false, values: {} };

  return { problem: null, done: true, values: {} };
}
