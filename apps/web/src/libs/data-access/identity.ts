import 'server-only';
import { cache } from 'react';
import {
  ApiError,
  command,
  forgetSession,
  keepIssuedSession,
  read,
  send,
  sessionPair,
} from './http';
import { type Outcome, problemOf, unreachable } from './problem';
import type {
  Invitation,
  InvitationPreview,
  Role,
  Session,
  User,
} from './types';

// The signed-in user, read once per render however many components ask.
export const currentUser = cache(async (): Promise<User | null> => {
  const pair = await sessionPair();

  if (pair === null) return null;

  const session = await read<Session>('/auth/session');
  return session?.user ?? null;
});

// Signs in and keeps the issued session; Server Actions only.
export async function signIn(
  email: string,
  password: string,
): Promise<Outcome<User>> {
  return issuing('/auth/session', 'POST', { email, password }, true);
}

export async function signOut(): Promise<void> {
  await command('/auth/session', { method: 'DELETE' });
  await forgetSession();
}

// Changes the own password; the API rotates the session, which is kept. Server Actions only.
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<Outcome<void>> {
  const outcome = await issuing(
    '/auth/password',
    'PATCH',
    { currentPassword, newPassword },
    false,
  );

  if (!outcome.ok) return outcome;

  return { ok: true, value: undefined };
}

export function requestRecovery(email: string): Promise<Outcome<void>> {
  return command('/auth/password-recovery', {
    method: 'POST',
    json: { email },
    anonymous: true,
  });
}

export function completeRecovery(
  token: string,
  newPassword: string,
): Promise<Outcome<void>> {
  return command('/auth/password-recovery/complete', {
    method: 'POST',
    json: { token, newPassword },
    anonymous: true,
  });
}

export async function invitations(): Promise<Invitation[]> {
  return (await read<Invitation[]>('/invitations')) ?? [];
}

export function invite(
  email: string,
  role: Role,
): Promise<Outcome<Invitation>> {
  return command('/invitations', { method: 'POST', json: { email, role } });
}

export function revokeInvitation(id: string): Promise<Outcome<void>> {
  return command(`/invitations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function verifyInvitation(
  token: string,
): Promise<Outcome<InvitationPreview>> {
  return command('/invitations/verify', {
    method: 'POST',
    json: { token },
    anonymous: true,
  });
}

// Accepts an invitation; the API signs the new person in. Server Actions only.
export async function acceptInvitation(
  token: string,
  name: string,
  password: string,
): Promise<Outcome<User>> {
  return issuing(
    '/invitations/accept',
    'POST',
    { token, name, password },
    true,
  );
}

async function issuing(
  path: string,
  method: 'POST' | 'PATCH',
  json: unknown,
  anonymous: boolean,
): Promise<Outcome<User>> {
  let response: Response;

  try {
    response = await send(path, { method, json, anonymous });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    return { ok: false, problem: unreachable(error.message) };
  }

  const body = await jsonOf(response);

  if (!response.ok)
    return { ok: false, problem: problemOf(response.status, body) };

  await keepIssuedSession(response);
  const user = (body as Session | undefined)?.user;
  return { ok: true, value: user as User };
}

async function jsonOf(response: Response): Promise<unknown> {
  const text = await response.text();

  try {
    return text === '' ? undefined : (JSON.parse(text) as unknown);
  } catch {
    return text;
  }
}
