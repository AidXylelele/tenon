import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type Outcome, problemOf, unreachable } from './problem';
import {
  issuedSession,
  REQUEST_URL_HEADER,
  sessionCookieName,
} from './session-cookie';

const PREFIX = '/api/v1';
const TIMEOUT_MS = 15_000;
const JSON_TYPE = 'application/json';

export interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly json?: unknown;
  readonly text?: string;
  readonly contentType?: string;
  readonly headers?: Record<string, string>;
  readonly query?: Record<string, string | number | undefined>;
  // Anonymous calls (sign-in, recovery, invitations) send no session, and their 401 is an
  // answer, not an ended session.
  readonly anonymous?: boolean;
  // A read whose answer never changes (a published version's document): kept in Next's data
  // cache, whose key holds the session cookie, so a refresh does not ask again (research R14).
  readonly immutable?: boolean;
}

// The API answered with a status the caller did not expect to handle (a 403 on a read, for
// example); error boundaries show it.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// One request to the API with the session forwarded. A 401 on a signed-in call ends at the
// sign-in page, which returns to the page being rendered.
export async function send(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const url = urlOf(path, options.query);
  const requestHeaders = await headersOf(options);
  const body = bodyOf(options);
  let response: Response;

  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: requestHeaders,
      body,
      cache: options.immutable === true ? 'force-cache' : 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // The cause (an address, a socket error) stays on the server; the person learns what to do.
    throw new ApiError(
      503,
      'The platform is not answering; try again in a moment',
    );
  }

  if (response.status === 401 && options.anonymous !== true)
    await signInAgain();

  return response;
}

// A read: the value, or null when the resource does not exist.
export async function read<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T | null> {
  const response = await send(path, options);

  if (response.status === 404) return null;

  if (!response.ok) {
    const problem = problemOf(response.status, await bodyOfResponse(response));
    throw new ApiError(response.status, problem.detail);
  }

  return (await response.json()) as T;
}

// A command: its value, or the API's refusal as a problem. 5xx answers are refusals too, so
// a form can say that the platform is unavailable and keep what was typed.
export async function command<T = void>(
  path: string,
  options: RequestOptions,
): Promise<Outcome<T>> {
  let response: Response;

  try {
    response = await send(path, options);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    return { ok: false, problem: unreachable(error.message) };
  }

  const body = await bodyOfResponse(response);

  if (!response.ok)
    return { ok: false, problem: problemOf(response.status, body) };

  return { ok: true, value: body as T };
}

export async function sessionPair(): Promise<string | null> {
  const store = await cookies();
  return store.get(sessionCookieName(secureCookies()))?.value ?? null;
}

// Keeps the session the API issued on this response (sign-in, a password change). Only
// Server Actions may call it, as only they can set cookies.
export async function keepIssuedSession(response: Response): Promise<void> {
  const issued = issuedSession(response.headers.getSetCookie());

  if (issued === null) return;

  const store = await cookies();
  const name = sessionCookieName(secureCookies());

  if (issued.maxAge <= 0) {
    store.delete(name);
    return;
  }

  store.set(name, issued.pair, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax',
    path: '/',
    maxAge: issued.maxAge,
  });
}

export async function forgetSession(): Promise<void> {
  const store = await cookies();
  store.delete(sessionCookieName(secureCookies()));
}

function apiUrl(): string {
  const url = process.env.API_URL;

  if (url === undefined || url === '')
    throw new Error('API_URL is not set: the console cannot reach the API');

  return url;
}

function secureCookies(): boolean {
  return process.env.SESSION_COOKIE_SECURE !== 'false';
}

function urlOf(path: string, query: RequestOptions['query']): URL {
  const url = new URL(`${PREFIX}${path}`, apiUrl());

  for (const [key, value] of Object.entries(query ?? {}))
    if (value !== undefined && value !== '')
      url.searchParams.set(key, String(value));

  return url;
}

async function headersOf(options: RequestOptions): Promise<Headers> {
  const result = new Headers(options.headers);
  result.set('accept', `${JSON_TYPE}, application/problem+json`);

  if (options.json !== undefined) result.set('content-type', JSON_TYPE);

  if (options.text !== undefined)
    result.set('content-type', options.contentType ?? 'text/plain');

  if (options.anonymous === true) return result;

  const pair = await sessionPair();

  if (pair !== null) result.set('cookie', pair);

  return result;
}

function bodyOf(options: RequestOptions): string | undefined {
  if (options.json !== undefined) return JSON.stringify(options.json);

  return options.text;
}

async function bodyOfResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text === '') return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function signInAgain(): Promise<never> {
  const requestHeaders = await headers();
  const back = requestHeaders.get(REQUEST_URL_HEADER) ?? '/';
  const next = encodeURIComponent(back);
  redirect(`/sign-in?reason=ended&next=${next}`);
}
