import type { Phase, WorkflowStatus } from "@/libs/data-access/types";

export const HOME_HREF = "/";

export const SIGN_IN_HREF = "/sign-in";
export const FORGOT_PASSWORD_HREF = "/forgot-password";
export const RESET_PASSWORD_HREF = "/reset-password";
export const ACCEPT_INVITATION_HREF = "/invitations/accept";

export const WORKFLOWS_HREF = "/workflows";
export const NEW_WORKFLOW_HREF = "/workflows/new";
export const RUNS_HREF = "/runs";

export const WEBHOOKS_HREF = "/webhooks";
export const NEW_WEBHOOK_HREF = "/webhooks?new=1";
export const TEST_EVENT_HREF = "/webhooks?test=1";
export const NOTIFICATIONS_HREF = "/notifications";
export const NEW_NOTIFICATION_HREF = "/notifications/new";
export const SECRETS_HREF = "/secrets";
export const NEW_SECRET_HREF = "/secrets?new=1";

export const WORKFLOW_SEARCH_HREF = "/search/workflows";

export const SETTINGS_HREF = "/settings";
export const ACCOUNT_HREF = "/settings/account";
export const PEOPLE_HREF = "/settings/people";
export const PLATFORM_HREF = "/settings/platform";

const EDITOR_PATH = /^\/workflows\/[^/]+\/[^/]+\/edit$/;

type SignInReason = "ended" | "signed-out" | "password-set";

interface SignInQuery {
  readonly reason?: SignInReason;
  readonly next?: string;
}

export const STARTED_WITHIN = ["1h", "24h", "7d"] as const;

export type StartedWithin = (typeof STARTED_WITHIN)[number];

interface RunsQuery {
  readonly namespace?: string;
  readonly name?: string;
  readonly version?: string;
  readonly phase?: Phase;
  readonly started?: StartedWithin;
  readonly cursor?: string;
}

interface WorkflowsQuery {
  readonly status?: WorkflowStatus;
  readonly cursor?: string;
  readonly q?: string;
}

interface WorkflowQuery {
  readonly tab?: "runs" | "versions";
  readonly start?: boolean;
}

export function signInHref(query: SignInQuery): string {
  return withQuery(SIGN_IN_HREF, query);
}

export function workflowsHref(query: WorkflowsQuery): string {
  return withQuery(WORKFLOWS_HREF, query);
}

export function workflowHref(
  namespace: string,
  name: string,
  query: WorkflowQuery = {},
): string {
  const path = `${WORKFLOWS_HREF}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`;
  const start = query.start === true ? "1" : undefined;
  return withQuery(path, { tab: query.tab, start });
}

export function editorHref(
  namespace: string,
  name: string,
  task: string | null = null,
): string {
  const path = `${workflowHref(namespace, name)}/edit`;
  return withQuery(path, { task });
}

export function isEditorPath(pathname: string): boolean {
  return pathname === NEW_WORKFLOW_HREF || EDITOR_PATH.test(pathname);
}

export function versionHref(
  namespace: string,
  name: string,
  version: string,
): string {
  return `${workflowHref(namespace, name)}/versions/${encodeURIComponent(version)}`;
}

export function runsHref(query: RunsQuery): string {
  return withQuery(RUNS_HREF, query);
}

export function runHref(id: string): string {
  return `${RUNS_HREF}/${encodeURIComponent(id)}`;
}

export function notificationHref(id: string): string {
  return `${NOTIFICATIONS_HREF}/${encodeURIComponent(id)}`;
}

function withQuery(path: string, query: object): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== null && value !== "")
      search.set(key, String(value));

  const text = search.toString();
  return text === "" ? path : `${path}?${text}`;
}
