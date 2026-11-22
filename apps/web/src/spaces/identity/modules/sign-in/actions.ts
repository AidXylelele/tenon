"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/libs/data-access/identity";
import { type FormState, refusalOf } from "@/libs/forms/form-state";
import { SignInFields } from "./form";

export async function signInAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const fields = Object.fromEntries(form);
  const parsed = SignInFields.safeParse(fields);

  if (!parsed.success) return refusalOf(parsed.error);

  const { email, password, next } = parsed.data;
  const outcome = await signIn(email, password);

  if (!outcome.ok)
    return { problem: outcome.problem, done: false, values: { email } };

  redirect(next);
}
