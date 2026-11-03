import type { InstanceFilter, WorkflowStatus } from '@/libs/data-access/types';

// The console's addresses: every page, and the queries its lists and the sign-in page read
// (research R15, R19). Nothing else in the console builds an address.

export const HOME_HREF = '/';

export const SIGN_IN_HREF = '/sign-in';
export const FORGOT_PASSWORD_HREF = '/forgot-password';
// The emailed link of a password reset, built by the API (passwordReset.url).
export const RESET_PASSWORD_HREF = '/reset-password';
// The emailed link of an invitation, built by the API (InvitationMail).
export const ACCEPT_INVITATION_HREF = '/invitations/accept';

export const WORKFLOWS_HREF = '/workflows';
export const NEW_WORKFLOW_HREF = '/workflows/new';
export const INSTANCES_HREF = '/instances';

export const CONNECTIONS_HREF = '/connections';
export const WEBHOOKS_HREF = '/connections/webhooks';
export const NOTIFICATIONS_HREF = '/connections/notifications';
export const NEW_NOTIFICATION_HREF = '/connections/notifications/new';
export const TEST_EVENT_HREF = '/connections/test-event';
export const CREDENTIALS_HREF = '/credentials';

export const SETTINGS_HREF = '/settings';
export const ACCOUNT_HREF = '/settings/account';
export const TEAM_HREF = '/settings/team';
export const STANDARD_HREF = '/settings/standard';

// Why a person is sent to sign in, which the page explains.
export type SignInReason = 'ended' | 'signed-out' | 'password-set';

export interface SignInQuery {
  readonly reason?: SignInReason;
  // The path inside the console to return to afterwards.
  readonly next?: string;
}

export interface WorkflowsQuery {
  readonly status?: WorkflowStatus;
  readonly cursor?: string;
}

export interface WorkflowQuery {
  // The tab the page opens on; without one, its overview.
  readonly tab?: 'runs' | 'versions';
  // Whether the page opens with the dialog that starts a run.
  readonly start?: boolean;
}

// The sign-in page, with why the person signs in and where they return afterwards.
export function signInHref(query: SignInQuery): string {
  return withQuery(SIGN_IN_HREF, query);
}

// The workflows list: its active or archived tab, and a page of it.
export function workflowsHref(query: WorkflowsQuery): string {
  return withQuery(WORKFLOWS_HREF, query);
}

// A workflow's page, on a tab or with a run being started.
export function workflowHref(
  namespace: string,
  name: string,
  query: WorkflowQuery = {},
): string {
  const path = `${WORKFLOWS_HREF}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`;
  const start = query.start === true ? '1' : undefined;
  return withQuery(path, { tab: query.tab, start });
}

// The editor of a workflow's next version, opened at a step when one is given.
export function editorHref(
  namespace: string,
  name: string,
  step: string | null = null,
): string {
  const path = `${workflowHref(namespace, name)}/edit`;
  return withQuery(path, { step });
}

// One published version of a workflow, as its document.
export function versionHref(
  namespace: string,
  name: string,
  version: string,
): string {
  return `${workflowHref(namespace, name)}/versions/${encodeURIComponent(version)}`;
}

// The runs list filtered as the address says, so a view can be shared and reloaded.
export function instancesHref(filter: InstanceFilter): string {
  return withQuery(INSTANCES_HREF, filter);
}

// A run's page.
export function instanceHref(id: string): string {
  return `${INSTANCES_HREF}/${encodeURIComponent(id)}`;
}

// A notification subscription's page.
export function notificationHref(id: string): string {
  return `${NOTIFICATIONS_HREF}/${encodeURIComponent(id)}`;
}

// A path with the values a query gives; an absent or empty value is left out.
function withQuery(path: string, query: object): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== null && value !== '')
      search.set(key, String(value));

  const text = search.toString();
  return text === '' ? path : `${path}?${text}`;
}
