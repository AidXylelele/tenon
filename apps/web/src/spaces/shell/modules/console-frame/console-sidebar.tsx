'use client';

import {
  ActivityIcon,
  ChevronsUpDownIcon,
  LayoutDashboardIcon,
  KeyRoundIcon,
  LogOutIcon,
  type LucideIcon,
  RadioTowerIcon,
  SendIcon,
  ShieldCheckIcon,
  UserIcon,
  UsersIcon,
  WaypointsIcon,
  WebhookIcon,
} from 'lucide-react';
import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role, User } from '@/libs/data-access/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/libs/ui/components/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  useSidebar,
} from '@/libs/ui/components/sidebar';
import { Spinner } from '@/libs/ui/components/spinner';
import { BrandMark, PRODUCT_NAME } from '../../__shared_context/brand-mark';
import { signOutAction } from './actions';

interface Item {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

interface Section {
  readonly label: string;
  readonly roles: readonly Role[];
  readonly items: readonly Item[];
}

const EVERYONE: readonly Role[] = ['admin', 'editor', 'viewer'];
const AUTHORS: readonly Role[] = ['admin', 'editor'];

// What each role may open (002 FR-031): viewers read automations only (research R12).
const SECTIONS: readonly Section[] = [
  {
    label: 'Workspace',
    roles: EVERYONE,
    items: [
      { href: '/', label: 'Overview', icon: LayoutDashboardIcon },
      { href: '/workflows', label: 'Workflows', icon: WaypointsIcon },
      { href: '/instances', label: 'Runs', icon: ActivityIcon },
    ],
  },
  {
    label: 'Connections',
    roles: AUTHORS,
    items: [
      { href: '/webhooks', label: 'Webhooks', icon: WebhookIcon },
      { href: '/subscriptions', label: 'Subscriptions', icon: RadioTowerIcon },
      { href: '/events', label: 'Event tester', icon: SendIcon },
    ],
  },
  {
    label: 'Credentials',
    roles: AUTHORS,
    items: [{ href: '/secrets', label: 'Secrets', icon: KeyRoundIcon }],
  },
];

// Pages of the platform itself, at the foot of the navigation.
const FOOT: readonly Section[] = [
  {
    label: 'Platform',
    roles: EVERYONE,
    items: [
      {
        href: '/conformance',
        label: 'Supported standard',
        icon: ShieldCheckIcon,
      },
    ],
  },
  {
    label: 'Team',
    roles: ['admin'],
    items: [{ href: '/team', label: 'Invitations', icon: UsersIcon }],
  },
];

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  editor: 'Editor',
  viewer: 'Viewer',
};

// The console's navigation: the sections the user's role may open, the page in view, and the
// user's menu. Without a user yet, it shows its shape while the session is read.
export function ConsoleSidebar({ user }: { readonly user: User | null }) {
  const pathname = usePathname();
  const allowed = (section: Section) =>
    user === null || section.roles.includes(user.role);
  const sections = SECTIONS.filter(allowed);
  const foot = FOOT.filter(allowed).flatMap((section) => section.items);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={PRODUCT_NAME}>
              <Link href="/">
                <BrandMark className="size-8" />
                <span className="font-semibold">{PRODUCT_NAME}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {user === null
                  ? section.items.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuSkeleton showIcon />
                      </SidebarMenuItem>
                    ))
                  : section.items.map((item) => (
                      <NavItem
                        key={item.href}
                        item={item}
                        active={isUnder(pathname, item.href)}
                      />
                    ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        {user !== null && (
          <SidebarMenu>
            {foot.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                active={isUnder(pathname, item.href)}
              />
            ))}
          </SidebarMenu>
        )}
        {user !== null && <UserMenu user={user} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavItem({
  item,
  active,
}: {
  readonly item: Item;
  readonly active: boolean;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        <Link
          href={item.href}
          onClick={() => isMobile && setOpenMobile(false)}
          aria-current={active ? 'page' : undefined}
        >
          <Icon />
          <span>{item.label}</span>
          <Pending />
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// The clicked item says that its page is on the way (docs, useLinkStatus).
function Pending() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return <Spinner className="ml-auto size-3.5 text-muted-foreground" />;
}

function UserMenu({ user }: { readonly user: User }) {
  const initials = initialsOf(user.name);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={user.name}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-xs font-medium">
                {initials}
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">
                  {user.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {ROLE_LABEL[user.role]}
                </span>
              </span>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {user.email}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account">
                <UserIcon />
                Account and password
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <form action={signOutAction} className="w-full">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2"
                >
                  <LogOutIcon className="size-4" />
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function isUnder(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';

  return pathname === href || pathname.startsWith(`${href}/`);
}

function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part !== '');
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}
