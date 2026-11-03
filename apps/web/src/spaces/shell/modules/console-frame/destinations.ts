import {
  ActivityIcon,
  CableIcon,
  HouseIcon,
  KeyRoundIcon,
  type LucideIcon,
  SettingsIcon,
  WaypointsIcon,
} from 'lucide-react';
import type { Role } from '@/libs/data-access/types';

export interface Destination {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly roles: readonly Role[];
}

const EVERYONE: readonly Role[] = ['admin', 'editor', 'viewer'];
const AUTHORS: readonly Role[] = ['admin', 'editor'];

// The console's five destinations (FR-034, research R15). Viewers read automations only
// (002 FR-031), so Connections and Credentials are for authors.
export const DESTINATIONS: readonly Destination[] = [
  { href: '/', label: 'Home', icon: HouseIcon, roles: EVERYONE },
  {
    href: '/workflows',
    label: 'Workflows',
    icon: WaypointsIcon,
    roles: EVERYONE,
  },
  { href: '/instances', label: 'Runs', icon: ActivityIcon, roles: EVERYONE },
  {
    href: '/connections',
    label: 'Connections',
    icon: CableIcon,
    roles: AUTHORS,
  },
  {
    href: '/credentials',
    label: 'Credentials',
    icon: KeyRoundIcon,
    roles: AUTHORS,
  },
];

export const SETTINGS: Destination = {
  href: '/settings',
  label: 'Settings',
  icon: SettingsIcon,
  roles: EVERYONE,
};

export function destinationsOf(role: Role | null): readonly Destination[] {
  if (role === null) return DESTINATIONS;

  return DESTINATIONS.filter((destination) => destination.roles.includes(role));
}

export function isUnder(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';

  return pathname === href || pathname.startsWith(`${href}/`);
}
