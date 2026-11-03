import {
  ActivityIcon,
  CableIcon,
  HouseIcon,
  KeyRoundIcon,
  type LucideIcon,
  SettingsIcon,
  WaypointsIcon,
} from 'lucide-react';
import type { User } from '@/libs/data-access/types';
import { type AccessRule, canAuthor } from '@/operations/access-policy';
import {
  CONNECTIONS_HREF,
  CREDENTIALS_HREF,
  HOME_HREF,
  INSTANCES_HREF,
  SETTINGS_HREF,
  WORKFLOWS_HREF,
} from '@/operations/app-routes';

export interface Destination {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
  // Who may open it, or null for everyone.
  readonly access: AccessRule | null;
}

// The console's five destinations (FR-034, research R15). Viewers read automations only
// (002 FR-031), so Connections and Credentials are for authors.
export const DESTINATIONS: readonly Destination[] = [
  { href: HOME_HREF, label: 'Home', icon: HouseIcon, access: null },
  {
    href: WORKFLOWS_HREF,
    label: 'Workflows',
    icon: WaypointsIcon,
    access: null,
  },
  { href: INSTANCES_HREF, label: 'Runs', icon: ActivityIcon, access: null },
  {
    href: CONNECTIONS_HREF,
    label: 'Connections',
    icon: CableIcon,
    access: canAuthor,
  },
  {
    href: CREDENTIALS_HREF,
    label: 'Credentials',
    icon: KeyRoundIcon,
    access: canAuthor,
  },
];

export const SETTINGS: Destination = {
  href: SETTINGS_HREF,
  label: 'Settings',
  icon: SettingsIcon,
  access: null,
};

// The destinations the user may open; without a user yet, all of them, as the navigation's
// shape while the session is read.
export function destinationsOf(user: User | null): readonly Destination[] {
  if (user === null) return DESTINATIONS;

  return DESTINATIONS.filter(
    (destination) => destination.access === null || destination.access(user),
  );
}

// Whether a path lies under a destination; Home holds only itself.
export function isUnder(pathname: string, href: string): boolean {
  if (href === HOME_HREF) return pathname === HOME_HREF;

  return pathname === href || pathname.startsWith(`${href}/`);
}
