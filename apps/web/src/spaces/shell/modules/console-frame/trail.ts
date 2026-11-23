import {
  isEditorPath,
  NOTIFICATIONS_HREF,
  RUNS_HREF,
  SETTINGS_HREF,
  TEST_EVENT_HREF,
  workflowHref,
  WORKFLOWS_HREF,
} from "@/libs/routing/routes";
import {
  type Place,
  placeOf,
  SETTINGS_PAGES,
} from "../../__shared_context/places";
import { runLabelOf } from "../../__shared_context/run-label";

export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

const TEST_EVENT: Crumb = { label: "Send a test event" };
const NEW_WORKFLOW: Crumb = { label: "New workflow" };
const NEW_NOTIFICATION: Crumb = { label: "New notification" };
const NOTIFICATION: Crumb = { label: "Notification" };
const EDITOR: Crumb = { label: "Editor" };

export function trailOf(pathname: string): readonly Crumb[] {
  const place = placeOf(pathname);

  if (place === null) return [];

  const below = belowOf(place, pathname);

  if (below.length === 0) return [{ label: place.label }];

  const top: Crumb = { label: place.label, href: place.href };
  return [top].concat(below);
}

function belowOf(place: Place, pathname: string): readonly Crumb[] {
  if (pathname === TEST_EVENT_HREF) return [TEST_EVENT];

  const after = pathname.slice(place.href.length);
  const rest = segmentsOf(after);
  const editing = isEditorPath(pathname);

  switch (place.href) {
    case WORKFLOWS_HREF:
      return workflowCrumbs(rest, editing);
    case RUNS_HREF:
      return runCrumbs(rest);
    case NOTIFICATIONS_HREF:
      return notificationCrumbs(rest);
    case SETTINGS_HREF:
      return settingsCrumbs(rest);
    default:
      return [];
  }
}

function workflowCrumbs(
  rest: readonly string[],
  editing: boolean,
): readonly Crumb[] {
  const [namespace, name, part, version] = rest;

  if (namespace === "new" && name === undefined) return [NEW_WORKFLOW];

  if (namespace === undefined || name === undefined) return [];

  if (part === undefined) return [{ label: name }];

  const href = workflowHref(namespace, name);
  const workflow: Crumb = { label: name, href };

  if (editing) return [workflow, EDITOR];

  if (part !== "versions" || version === undefined) return [workflow];

  const label = `Version ${version}`;
  return [workflow, { label }];
}

function runCrumbs(rest: readonly string[]): readonly Crumb[] {
  const [id] = rest;

  if (id === undefined) return [];

  const label = runLabelOf(id);
  return [{ label }];
}

function notificationCrumbs(rest: readonly string[]): readonly Crumb[] {
  const [id] = rest;

  if (id === undefined) return [];

  if (id === "new") return [NEW_NOTIFICATION];

  return [NOTIFICATION];
}

function settingsCrumbs(rest: readonly string[]): readonly Crumb[] {
  const [slug] = rest;
  const href = `${SETTINGS_HREF}/${slug ?? ""}`;
  const page = SETTINGS_PAGES.find((each) => each.href === href);

  if (page === undefined) return [];

  return [{ label: page.label }];
}

function segmentsOf(path: string): readonly string[] {
  return path
    .split("/")
    .filter((segment) => segment !== "")
    .map(decoded);
}

function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
