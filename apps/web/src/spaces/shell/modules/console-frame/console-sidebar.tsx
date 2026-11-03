'use client';

import { ChevronsUpDownIcon, LogOutIcon, UserIcon } from 'lucide-react';
import { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@/libs/data-access/types';
import { Link } from '@/libs/routing/link';
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  useSidebar,
} from '@/libs/ui/components/sidebar';
import { Spinner } from '@/libs/ui/components/spinner';
import { roleLabel } from '@/operations/access-policy';
import { ACCOUNT_HREF, HOME_HREF } from '@/operations/app-routes';
import { BrandMark, PRODUCT_NAME } from '../../__shared_context/brand-mark';
import { signOutAction } from './actions';
import {
  type Destination,
  destinationsOf,
  isUnder,
  SETTINGS,
} from './destinations';

// The console's navigation (research R15): the destinations the user's role may open, Settings
// at the foot, and the user's menu. Without a user yet, it shows its shape while the session is
// read.
export function ConsoleSidebar({ user }: { readonly user: User | null }) {
  const pathname = usePathname();
  const destinations = destinationsOf(user);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={PRODUCT_NAME}>
              <Link href={HOME_HREF}>
                <BrandMark className="size-8" />
                <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
                  {PRODUCT_NAME}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {destinations.map((destination) =>
                user === null ? (
                  <SidebarMenuItem key={destination.href}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ) : (
                  <NavItem
                    key={destination.href}
                    item={destination}
                    active={isUnder(pathname, destination.href)}
                  />
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {user !== null && (
          <SidebarMenu>
            <NavItem
              item={SETTINGS}
              active={isUnder(pathname, SETTINGS.href)}
            />
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
  readonly item: Destination;
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
                  {roleLabel(user.role)}
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
              <Link href={ACCOUNT_HREF}>
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

function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part !== '');
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}
