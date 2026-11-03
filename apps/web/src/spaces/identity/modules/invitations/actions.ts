'use server';

import { refresh } from 'next/cache';
import { invite, revokeInvitation } from '@/libs/data-access/identity';
import type { Role } from '@/libs/data-access/types';
import { field, type FormState } from '@/libs/forms/form-state';

const ROLES: readonly Role[] = ['admin', 'editor', 'viewer'];

export async function inviteAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const email = field(form, 'email').trim();
  const chosen = field(form, 'role');
  const role = ROLES.find((each) => each === chosen) ?? 'viewer';
  const outcome = await invite(email, role);

  if (!outcome.ok)
    return { problem: outcome.problem, done: false, values: { email, role } };

  refresh();
  return { problem: null, done: true, values: { email } };
}

export async function revokeAction(id: string): Promise<FormState> {
  const outcome = await revokeInvitation(id);

  if (!outcome.ok) return { problem: outcome.problem, done: false, values: {} };

  refresh();
  return { problem: null, done: true, values: {} };
}
