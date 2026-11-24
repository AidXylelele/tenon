"use server";

import { redirect } from "next/navigation";
import { acceptInvitation } from "@/libs/data-access/identity";
import { type FormState, refusalOf } from "@/libs/forms/form-state";
import { HOME_HREF } from "@/libs/routing/routes";
import { AcceptanceFields } from "./form";

export async function acceptInvitationAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const fields = Object.fromEntries(form);
  const parsed = AcceptanceFields.safeParse(fields);

  if (!parsed.success) return refusalOf(parsed.error);

  const { token, name, password } = parsed.data;
  const outcome = await acceptInvitation(token, name, password);

  if (!outcome.ok)
    return { problem: outcome.problem, done: false, values: { name } };

  redirect(HOME_HREF);
}
