'use server';

import { redirect } from 'next/navigation';
import { completeRecovery } from '@/libs/data-access/identity';
import { field, type FormState } from '@/libs/forms/form-state';

export async function resetPasswordAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const outcome = await completeRecovery(
    field(form, 'token'),
    field(form, 'password'),
  );

  if (!outcome.ok) return { problem: outcome.problem, done: false, values: {} };

  redirect('/sign-in?reason=password-set');
}
