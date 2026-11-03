'use server';

import { redirect } from 'next/navigation';
import { signIn } from '@/libs/data-access/identity';
import {
  field,
  type FormState,
  returnPath,
} from '../../__shared_context/form-state';

export async function signInAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const email = field(form, 'email').trim();
  const password = field(form, 'password');
  const outcome = await signIn(email, password);

  if (!outcome.ok)
    return { problem: outcome.problem, done: false, values: { email } };

  redirect(returnPath(field(form, 'next')));
}
