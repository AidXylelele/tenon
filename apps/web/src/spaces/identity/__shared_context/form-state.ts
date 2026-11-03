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

// A path inside the console to return to after signing in. It is resolved the way a browser
// resolves it, so a value that leaves the console (another origin, `//host`, `/\\host`, a tab or
// a newline that browsers strip) returns to the start page instead.
export function returnPath(next: string | undefined): string {
  const start = '/';

  if (next === undefined || !next.startsWith('/')) return start;

  const base = 'http://console.invalid';
  let url: URL;

  try {
    url = new URL(next, base);
  } catch {
    return start;
  }

  if (url.origin !== base) return start;

  return `${url.pathname}${url.search}${url.hash}`;
}

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
