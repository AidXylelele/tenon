'use server';

import { changePassword } from '@/libs/data-access/identity';
import { field, type FormState } from '../../__shared_context/form-state';

export async function changePasswordAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const outcome = await changePassword(
    field(form, 'currentPassword'),
    field(form, 'newPassword'),
  );

  if (!outcome.ok) return { problem: outcome.problem, done: false, values: {} };

  return { problem: null, done: true, values: {} };
}
