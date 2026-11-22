"use client";

import {
  ChevronsUpDownIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
} from "lucide-react";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Session, User } from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import { PRODUCT_NAME } from "@/libs/routing/page-title";
import { ACCOUNT_HREF, HOME_HREF } from "@/libs/routing/routes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/libs/ui/components/dropdown-menu";
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
  SidebarSeparator,
  useSidebar,
} from "@/libs/ui/components/sidebar";
import { Spinner } from "@/libs/ui/components/spinner";
import { roleLabel } from "@/operations/roles";
import { BrandLockup } from "../../__shared_context/brand-mark";
import {
  type Theme,
  themeAttributeOf,
  themeOf,
} from "../../__shared_context/theme";
import { chooseThemeAction, signOutAction } from "./actions";
import {
  type Destination,
  destinationsOf,
  isUnder,
  SETTINGS,
} from "./destinations";

const CURRENT_BAR =
  "relative data-active:before:absolute data-active:before:inset-y-1.5 data-active:before:left-0 data-active:before:w-0.5 data-active:before:rounded-full data-active:before:bg-primary";

interface ConsoleSidebarProps {
  readonly session: Session | null;
  readonly theme: Theme;
  readonly loading: boolean;
}

export function ConsoleSidebar({
  session,
  theme,
  loading,
}: ConsoleSidebarProps) {
  const pathname = usePathname();
  const destinations = destinationsOf(session?.capabilities ?? null);

  return (
    <Sidebar collapsible="icon" aria-label="Console">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={PRODUCT_NAME}
              className="[&_svg]:size-8!"
            >
              <Link href={HOME_HREF} aria-label={PRODUCT_NAME}>
                <BrandLockup wordClassName="group-data-[collapsible=icon]:hidden" />
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
                loading ? (
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
        {!loading && (
          <SidebarMenu>
            <NavItem
              item={SETTINGS}
              active={isUnder(pathname, SETTINGS.href)}
            />
          </SidebarMenu>
        )}
        {session !== null && (
          <>
            <SidebarSeparator className="mx-0" />
            <UserMenu user={session.user} theme={theme} />
          </>
        )}
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
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className={CURRENT_BAR}
      >
        <Link
          href={item.href}
          onClick={() => {
            if (isMobile) setOpenMobile(false);
          }}
          aria-current={active ? "page" : undefined}
        >
          <Icon />
          <span>{item.label}</span>
          <Pending />
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function Pending() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return <Spinner className="ml-auto size-3.5 text-muted-foreground" />;
}

function UserMenu({
  user,
  theme,
}: {
  readonly user: User;
  readonly theme: Theme;
}) {
  const initials = initialsOf(user.name);
  const role = roleLabel(user.role);
  const [shown, setShown] = useState(theme);

  function choose(value: string) {
    const chosen = themeOf(value);
    setShown(chosen);
    const attribute = themeAttributeOf(chosen);
    const root = document.documentElement;

    if (attribute === undefined) delete root.dataset.theme;
    else root.dataset.theme = attribute;

    void chooseThemeAction(chosen);
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={user.name}>
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-foreground"
                aria-hidden
              >
                {initials}
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">
                  {user.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {role}
                </span>
              </span>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="truncate text-sm font-medium text-foreground">
                {user.name}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {user.email}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={ACCOUNT_HREF}>
                <UserIcon />
                Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <SunIcon />
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={shown} onValueChange={choose}>
                  <DropdownMenuRadioItem value="light">
                    <SunIcon />
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <MoonIcon />
                    Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <MonitorIcon />
                    System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                void signOutAction();
              }}
            >
              <LogOutIcon />
              Sign out
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
    .filter((part) => part !== "");
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}
