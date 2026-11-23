"use client";

import {
  ChevronsUpDownIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
} from "lucide-react";
import type { User } from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import { ACCOUNT_HREF } from "@/libs/routing/routes";
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/libs/ui/components/sidebar";
import { roleLabel } from "@/operations/roles";
import { type KeepTheme, useThemeChoice } from "./theme-choice";

interface AccountMenuProps {
  readonly user: User;
  readonly signOut: () => Promise<void>;
  readonly keepTheme: KeepTheme;
}

export function AccountMenu({ user, signOut, keepTheme }: AccountMenuProps) {
  const initials = initialsOf(user.name);
  const role = roleLabel(user.role);
  const { theme, choose } = useThemeChoice(keepTheme);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={user.name}>
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-text"
                aria-hidden
              >
                {initials}
              </span>
              <span className="grid flex-1 text-left">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-caption text-muted-foreground">
                  {user.email}
                </span>
              </span>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="truncate font-semibold text-foreground">
                {user.name}
              </div>
              <div className="truncate text-caption text-muted-foreground">
                {user.email}
              </div>
              <div className="truncate text-caption text-muted-foreground">
                {role}
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
                <DropdownMenuRadioGroup value={theme} onValueChange={choose}>
                  <DropdownMenuRadioItem value="system">
                    <MonitorIcon />
                    System
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="light">
                    <SunIcon />
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <MoonIcon />
                    Dark
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                void signOut();
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
