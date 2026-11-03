'use server';

import { requestRecovery } from '@/libs/data-access/identity';
import { field, type FormState } from '@/libs/forms/form-state';

export async function requestRecoveryAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const email = field(form, 'email').trim();
  const outcome = await requestRecovery(email);

  if (!outcome.ok)
    return { problem: outcome.problem, done: false, values: { email } };

  return { problem: null, done: true, values: { email } };
}
