import {
  ActivityIcon,
  CableIcon,
  HouseIcon,
  KeyRoundIcon,
  type LucideIcon,
  MailIcon,
  RadioTowerIcon,
  ServerIcon,
  SendIcon,
  SettingsIcon,
  UserIcon,
  WaypointsIcon,
  WebhookIcon,
} from "lucide-react";
import type { Capabilities } from "@/libs/data-access/types";
import {
  ACCOUNT_HREF,
  CONNECTIONS_HREF,
  HOME_HREF,
  INVITATIONS_HREF,
  NOTIFICATIONS_HREF,
  PLATFORM_HREF,
  RUNS_HREF,
  runsHref,
  SECRETS_HREF,
  SETTINGS_HREF,
  TEST_EVENT_HREF,
  WEBHOOKS_HREF,
  WORKFLOWS_HREF,
} from "@/libs/routing/routes";

export interface Destination {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly access: keyof Capabilities | null;
}

const DESTINATIONS: readonly Destination[] = [
  { href: HOME_HREF, label: "Home", icon: HouseIcon, access: null },
  {
    href: WORKFLOWS_HREF,
    label: "Workflows",
    icon: WaypointsIcon,
    access: null,
  },
  { href: RUNS_HREF, label: "Runs", icon: ActivityIcon, access: null },
  {
    href: CONNECTIONS_HREF,
    label: "Connections",
    icon: CableIcon,
    access: "author",
  },
  {
    href: SECRETS_HREF,
    label: "Secrets",
    icon: KeyRoundIcon,
    access: "author",
  },
];

const FURTHER_PAGES: readonly Destination[] = [
  {
    href: runsHref({ phase: "faulted" }),
    label: "Runs that faulted",
    icon: ActivityIcon,
    access: null,
  },
  {
    href: WEBHOOKS_HREF,
    label: "Webhooks",
    icon: WebhookIcon,
    access: "author",
  },
  {
    href: NOTIFICATIONS_HREF,
    label: "Notifications",
    icon: RadioTowerIcon,
    access: "author",
  },
  {
    href: TEST_EVENT_HREF,
    label: "Send a test event",
    icon: SendIcon,
    access: "author",
  },
  { href: ACCOUNT_HREF, label: "Account", icon: UserIcon, access: null },
  {
    href: INVITATIONS_HREF,
    label: "Invitations",
    icon: MailIcon,
    access: "administrator",
  },
  { href: PLATFORM_HREF, label: "Platform", icon: ServerIcon, access: null },
];

const PAGES = DESTINATIONS.concat(FURTHER_PAGES);

export const SETTINGS: Destination = {
  href: SETTINGS_HREF,
  label: "Settings",
  icon: SettingsIcon,
  access: null,
};

export function destinationsOf(
  capabilities: Capabilities | null,
): readonly Destination[] {
  if (capabilities === null) return DESTINATIONS;

  return DESTINATIONS.filter((destination) =>
    allows(destination, capabilities),
  );
}

export function pagesOf(
  capabilities: Capabilities | null,
): readonly Destination[] {
  return PAGES.filter((page) => allows(page, capabilities));
}

export function isUnder(pathname: string, href: string): boolean {
  if (href === HOME_HREF) return pathname === HOME_HREF;

  return pathname === href || pathname.startsWith(`${href}/`);
}

function allows(
  destination: Destination,
  capabilities: Capabilities | null,
): boolean {
  const access = destination.access;
  return access === null || capabilities?.[access] === true;
}
