import type { Problem } from '@/libs/data-access/problem';

// What a form's action answers: nothing yet, the API's refusal, or what it achieved.
export interface FormState {
  readonly problem: Problem | null;
  readonly done: boolean;
  // Values the form shows again after a refusal; passwords are never sent back.
  readonly values: Record<string, string>;
}

export const IDLE: FormState = { problem: null, done: false, values: {} };

export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

// A path inside the console to return to after signing in; anything else (another origin,
// a protocol-relative URL) returns to the start page.
export function returnPath(next: string | undefined): string {
  if (next === undefined || !next.startsWith('/')) return '/workflows';

  if (next.startsWith('//') || next.startsWith('/\\')) return '/workflows';

  return next;
}

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
