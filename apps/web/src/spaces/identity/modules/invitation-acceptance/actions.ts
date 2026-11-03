'use server';

import { redirect } from 'next/navigation';
import { acceptInvitation } from '@/libs/data-access/identity';
import { field, type FormState } from '../../__shared_context/form-state';

export async function acceptInvitationAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const name = field(form, 'name').trim();
  const outcome = await acceptInvitation(
    field(form, 'token'),
    name,
    field(form, 'password'),
  );

  if (!outcome.ok)
    return { problem: outcome.problem, done: false, values: { name } };

  redirect('/workflows');
}
