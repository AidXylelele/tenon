"use server";

import { refresh } from "next/cache";
import { invite, revokeInvitation } from "@/libs/data-access/identity";
import type { Outcome } from "@/libs/data-access/problem";
import { type FormState, refusalOf } from "@/libs/forms/form-state";
import { InviteFields } from "./form";

export async function inviteAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const fields = Object.fromEntries(form);
  const parsed = InviteFields.safeParse(fields);

  if (!parsed.success) return refusalOf(parsed.error);

  const { email, role } = parsed.data;
  const outcome = await invite(email, role);

  if (!outcome.ok)
    return { problem: outcome.problem, done: false, values: { email, role } };

  refresh();
  return { problem: null, done: true, values: { email } };
}

export async function revokeAction(id: string): Promise<Outcome<void>> {
  const outcome = await revokeInvitation(id);
  refresh();
  return outcome;
}
