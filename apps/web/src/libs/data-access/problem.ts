// A refusal of the API as an RFC 9457 problem. Feature 002 answers problem+json; feature 001
// and the framework's own answers (413, 415, 503) keep Nest's `{ statusCode, message, error }`,
// which is read into the same shape.

export interface ProblemLocation {
  readonly pointer: string;
  readonly detail: string;
}

export interface Problem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly errors: ProblemLocation[];
}

export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: Problem };

const ABOUT_BLANK = 'about:blank';

export function problemOf(status: number, body: unknown): Problem {
  const fields = isRecord(body) ? body : {};
  const title =
    textOf(fields.title) ?? textOf(fields.error) ?? `HTTP ${status}`;
  const detail = textOf(fields.detail) ?? messageOf(fields.message) ?? title;
  const errors = locationsOf(fields.errors);
  return {
    type: textOf(fields.type) ?? ABOUT_BLANK,
    title,
    status,
    detail,
    errors,
  };
}

// The platform's own code of a named refusal (`urn:problem:<code>`), or null.
export function codeOf(problem: Problem): string | null {
  const prefix = 'urn:problem:';

  if (!problem.type.startsWith(prefix)) return null;

  return problem.type.slice(prefix.length);
}

export function unreachable(detail: string): Problem {
  return {
    type: ABOUT_BLANK,
    title: 'The platform is not answering',
    status: 503,
    detail,
    errors: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textOf(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;

  return value;
}

function messageOf(value: unknown): string | null {
  if (Array.isArray(value)) return value.filter(isText).join('; ') || null;

  return textOf(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string';
}

function locationsOf(value: unknown): ProblemLocation[] {
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord).flatMap((item) => {
    const pointer = textOf(item.pointer);
    const detail = textOf(item.detail);

    if (pointer === null && detail === null) return [];

    return [{ pointer: pointer ?? '', detail: detail ?? '' }];
  });
}
