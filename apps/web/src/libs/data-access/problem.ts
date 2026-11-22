import { isObject } from "@/libs/json/json";

interface ProblemLocation {
  readonly pointer: string;
  readonly detail: string;
  readonly line: number | null;
  readonly column: number | null;
}

export interface Problem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly errors: ProblemLocation[];
  readonly retryAfter: number | null;
}

export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: Problem };

const ABOUT_BLANK = "about:blank";
const TOO_MANY_REQUESTS = 429;
const MINUTE_SECONDS = 60;
const SECOND_MS = 1000;
const relative = new Intl.RelativeTimeFormat("en", { numeric: "always" });

export function problemOf(
  status: number,
  body: unknown,
  retryAfter: string | null,
): Problem {
  const isJsonObject = isObject(body);
  const fields = isJsonObject ? body : {};
  const type = textOf(fields.type) ?? ABOUT_BLANK;
  const title = textOf(fields.title) ?? `HTTP ${String(status)}`;
  const wait = secondsOf(retryAfter);
  const detail =
    status === TOO_MANY_REQUESTS
      ? waitDetail(wait)
      : (textOf(fields.detail) ?? title);
  const errors = locationsOf(fields.errors);
  return { type, title, status, detail, errors, retryAfter: wait };
}

export function codeOf(problem: Problem): string | null {
  const prefix = "urn:problem:";
  const isNamed = problem.type.startsWith(prefix);

  if (!isNamed) return null;

  return problem.type.slice(prefix.length);
}

export function unreachable(detail: string): Problem {
  return {
    type: ABOUT_BLANK,
    title: "The platform is not answering",
    status: 503,
    detail,
    errors: [],
    retryAfter: null,
  };
}

function textOf(value: unknown): string | null {
  const hasText = typeof value === "string" && value !== "";

  if (!hasText) return null;

  return value;
}

function positionOf(value: unknown): number | null {
  return typeof value === "number" && value >= 1 ? value : null;
}

function waitDetail(seconds: number | null): string {
  if (seconds === null)
    return "Too many tries in a short time; wait a while and try again";

  const after =
    seconds < MINUTE_SECONDS
      ? relative.format(seconds, "second")
      : relative.format(Math.ceil(seconds / MINUTE_SECONDS), "minute");
  return `Too many tries in a short time; try again ${after}`;
}

function secondsOf(retryAfter: string | null): number | null {
  if (retryAfter === null) return null;

  const at = /^\d+$/.test(retryAfter)
    ? Number(retryAfter)
    : Math.ceil((Date.parse(retryAfter) - Date.now()) / SECOND_MS);

  if (Number.isNaN(at) || at <= 0) return null;

  return at;
}

function locationsOf(value: unknown): ProblemLocation[] {
  const isList = Array.isArray(value);

  if (!isList) return [];

  return value.filter(isObject).flatMap((item) => {
    const pointer = textOf(item.pointer) ?? "";
    const detail = textOf(item.detail) ?? "";
    const line = positionOf(item.line);
    const column = positionOf(item.column);
    const isBlank = pointer === "" && detail === "";

    if (isBlank) return [];

    return [{ pointer, detail, line, column }];
  });
}
