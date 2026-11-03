import type { User } from '@/libs/data-access/types';

// Who may do what in the console (002 FR-031). The console only hides what the API would
// refuse; the API decides.

// A rule of the policy: whether a user, or nobody signed in yet, may do something.
export type AccessRule = (user: User | null) => boolean;

// Whether the user may change automations: publish, start, control and connect.
export function canAuthor(user: User | null): boolean {
  return user?.role === 'admin' || user?.role === 'editor';
}

// Whether the user runs the team: sees it and invites people to it.
export function isAdministrator(user: User | null): boolean {
  return user?.role === 'admin';
}
