import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { apiUrl, isSessionCookieSecure } from "./environment";
import { type Outcome, type Problem, problemOf, unreachable } from "./problem";
import { ZONE_COOKIE, zoneOf } from "./viewer-zone";
import {
  issuedSession,
  SIGN_IN_AGAIN_HEADER,
  sessionCookieName,
} from "./session-cookie";

const PREFIX = "/api/v1";
const TIMEOUT_MS = 15_000;
const JSON_TYPE = "application/json";
const FORWARDED_FOR = "x-forwarded-for";
const ACCEPTED_TYPES = `${JSON_TYPE}, application/problem+json`;

export interface RequestOptions {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly json?: unknown;
  readonly text?: string;
  readonly contentType?: string;
  readonly headers?: Record<string, string>;
  readonly query?: Record<
    string,
    string | number | readonly string[] | undefined
  >;
  readonly anonymous?: boolean;
  readonly immutable?: boolean;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

export async function send(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const url = urlOf(path, options.query);
  const apiHeaders = await headersOf(options);
  const body = bodyOf(options);
  const method = options.method ?? "GET";
  const cache = options.immutable === true ? "force-cache" : "no-store";
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: apiHeaders,
      body,
      cache,
      redirect: "manual",
      signal,
    });
  } catch (error) {
    throw new ApiError(
      503,
      "The platform is not answering; try again in a moment",
      { cause: error },
    );
  }

  const sessionEnded = response.status === 401 && options.anonymous !== true;

  if (sessionEnded) await signInAgain();

  return response;
}

export async function read<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T | null> {
  const response = await send(path, options);

  if (response.status === 404) return null;

  if (!response.ok) {
    const problem = await problemOfResponse(response);
    throw new ApiError(response.status, problem.detail);
  }

  return (await response.json()) as T;
}

export const UNAVAILABLE = Symbol("unavailable");

export async function available<T>(
  reading: Promise<T>,
): Promise<T | typeof UNAVAILABLE> {
  try {
    return await reading;
  } catch (error) {
    if (error instanceof ApiError && error.status >= 500) return UNAVAILABLE;

    throw error;
  }
}

export async function command<T = void>(
  path: string,
  options: RequestOptions,
): Promise<Outcome<T>> {
  let response: Response;

  try {
    response = await send(path, options);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    const problem = unreachable(error.message);
    return { ok: false, problem };
  }

  if (!response.ok) {
    const problem = await problemOfResponse(response);
    return { ok: false, problem };
  }

  const body = await bodyOfResponse(response);
  return { ok: true, value: body as T };
}

export async function viewerZone(): Promise<string> {
  const store = await cookies();
  const kept = store.get(ZONE_COOKIE)?.value;
  const text = kept === undefined ? undefined : decodeURIComponent(kept);
  return zoneOf(text);
}

export async function sessionPair(): Promise<string | null> {
  const store = await cookies();
  const secure = isSessionCookieSecure();
  const name = sessionCookieName(secure);
  return store.get(name)?.value ?? null;
}

export async function keepIssuedSession(response: Response): Promise<void> {
  const setCookies = response.headers.getSetCookie();
  const issued = issuedSession(setCookies);

  if (issued === null) return;

  if (issued.maxAge <= 0) {
    await setSessionCookie("", 0);
    return;
  }

  await setSessionCookie(issued.pair, issued.maxAge);
}

export async function forgetSession(): Promise<void> {
  await setSessionCookie("", 0);
}

async function setSessionCookie(value: string, maxAge: number): Promise<void> {
  const store = await cookies();
  const secure = isSessionCookieSecure();
  const name = sessionCookieName(secure);
  store.set(name, value, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

function urlOf(path: string, query: RequestOptions["query"] = {}): URL {
  const pathname = `${PREFIX}${path}`;
  const base = apiUrl();
  const url = new URL(pathname, base);

  for (const [key, value] of Object.entries(query)) {
    const values = [value].flat();

    for (const each of values) {
      const omitted = each === undefined || each === "";

      if (omitted) continue;

      const parameter = String(each);
      url.searchParams.append(key, parameter);
    }
  }

  return url;
}

async function headersOf(options: RequestOptions): Promise<Headers> {
  const result = new Headers(options.headers);
  result.set("accept", ACCEPTED_TYPES);

  if (options.json !== undefined) result.set("content-type", JSON_TYPE);

  if (options.text !== undefined) {
    const textType = options.contentType ?? "text/plain";
    result.set("content-type", textType);
  }

  const incoming = await headers();
  const forwarded = incoming.get(FORWARDED_FOR);

  if (forwarded !== null) result.set(FORWARDED_FOR, forwarded);

  if (options.anonymous === true) return result;

  const pair = await sessionPair();

  if (pair !== null) result.set("cookie", pair);

  return result;
}

function bodyOf(options: RequestOptions): string | undefined {
  if (options.json !== undefined) return JSON.stringify(options.json);

  return options.text;
}

export async function problemOfResponse(response: Response): Promise<Problem> {
  const body = await bodyOfResponse(response);
  const retryAfter = response.headers.get("retry-after");
  return problemOf(response.status, body, retryAfter);
}

export async function bodyOfResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text === "") return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function signInAgain(): Promise<never> {
  const requestHeaders = await headers();
  const address = requestHeaders.get(SIGN_IN_AGAIN_HEADER);

  if (address === null)
    throw new ApiError(401, "The session has ended; sign in again");

  redirect(address);
}
