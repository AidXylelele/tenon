import type { Problem } from '@/libs/data-access/problem';

// What a form's action answers: nothing yet, the API's refusal, or what it achieved.
export interface FormState {
  readonly problem: Problem | null;
  readonly done: boolean;
  // Values the form shows again after a refusal; passwords are never sent back.
  readonly values: Record<string, string>;
}

export const IDLE: FormState = { problem: null, done: false, values: {} };

// A field of a submitted form as text; a missing field or a file reads as empty.
export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
