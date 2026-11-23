import {
  ActivityIcon,
  BellIcon,
  HouseIcon,
  KeyRoundIcon,
  type LucideIcon,
  MailIcon,
  ServerIcon,
  SettingsIcon,
  UserIcon,
  WebhookIcon,
  WorkflowIcon,
} from "lucide-react";
import type { Capabilities } from "@/libs/data-access/types";
import {
  ACCOUNT_HREF,
  HOME_HREF,
  NOTIFICATIONS_HREF,
  PEOPLE_HREF,
  PLATFORM_HREF,
  RUNS_HREF,
  SECRETS_HREF,
  SETTINGS_HREF,
  WEBHOOKS_HREF,
  WORKFLOWS_HREF,
} from "@/libs/routing/routes";

export type PlaceGroup = "work" | "connect" | "settings";

export interface Page {
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly access: keyof Capabilities | null;
}

export interface Place extends Page {
  readonly group: PlaceGroup;
  readonly covers: readonly string[];
}

export const PLACES: readonly Place[] = [
  {
    label: "Home",
    href: HOME_HREF,
    icon: HouseIcon,
    access: null,
    group: "work",
    covers: [HOME_HREF],
  },
  {
    label: "Workflows",
    href: WORKFLOWS_HREF,
    icon: WorkflowIcon,
    access: null,
    group: "work",
    covers: [WORKFLOWS_HREF],
  },
  {
    label: "Runs",
    href: RUNS_HREF,
    icon: ActivityIcon,
    access: null,
    group: "work",
    covers: [RUNS_HREF],
  },
  {
    label: "Webhooks",
    href: WEBHOOKS_HREF,
    icon: WebhookIcon,
    access: "author",
    group: "connect",
    covers: [WEBHOOKS_HREF],
  },
  {
    label: "Notifications",
    href: NOTIFICATIONS_HREF,
    icon: BellIcon,
    access: "author",
    group: "connect",
    covers: [NOTIFICATIONS_HREF],
  },
  {
    label: "Secrets",
    href: SECRETS_HREF,
    icon: KeyRoundIcon,
    access: "author",
    group: "connect",
    covers: [SECRETS_HREF],
  },
  {
    label: "Settings",
    href: SETTINGS_HREF,
    icon: SettingsIcon,
    access: null,
    group: "settings",
    covers: [SETTINGS_HREF],
  },
];

export const SETTINGS_PAGES: readonly Page[] = [
  { label: "Account", href: ACCOUNT_HREF, icon: UserIcon, access: null },
  {
    label: "People",
    href: PEOPLE_HREF,
    icon: MailIcon,
    access: "administrator",
  },
  { label: "Platform", href: PLATFORM_HREF, icon: ServerIcon, access: null },
];

export function placesOf(
  capabilities: Capabilities | null,
  group: PlaceGroup,
): readonly Place[] {
  const grouped = PLACES.filter((place) => place.group === group);
  return allowedOf(grouped, capabilities);
}

export function pagesOf(capabilities: Capabilities | null): readonly Page[] {
  const places: readonly Page[] = PLACES;
  const settingsPages = SETTINGS_PAGES.map(underSettings);
  const pages = places.concat(settingsPages);
  return allowedOf(pages, capabilities);
}

export function allowedOf<T extends Pick<Page, "access">>(
  entries: readonly T[],
  capabilities: Capabilities | null,
): readonly T[] {
  return entries.filter((entry) => allows(entry, capabilities));
}

export function placeOf(pathname: string): Place | null {
  const found = PLACES.find((place) => isCurrent(place, pathname));
  return found ?? null;
}

export function isCurrent(place: Place, pathname: string): boolean {
  return place.covers.some((href) => isUnder(pathname, href));
}

function isUnder(pathname: string, href: string): boolean {
  if (href === HOME_HREF) return pathname === HOME_HREF;

  return pathname === href || pathname.startsWith(`${href}/`);
}

function underSettings(page: Page): Page {
  const label = `Settings › ${page.label}`;
  return { label, href: page.href, icon: page.icon, access: page.access };
}

function allows(
  entry: Pick<Page, "access">,
  capabilities: Capabilities | null,
): boolean {
  const access = entry.access;
  return access === null || capabilities?.[access] === true;
}
