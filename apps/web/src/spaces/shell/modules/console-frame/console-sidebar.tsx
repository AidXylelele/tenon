"use client";

import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useEffectEvent, useId } from "react";
import type { Capabilities } from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import { PRODUCT_NAME } from "@/libs/routing/page-title";
import { HOME_HREF, RUNS_HREF } from "@/libs/routing/routes";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/libs/ui/components/sidebar";
import { Spinner } from "@/libs/ui/components/spinner";
import { BrandMark } from "../../__shared_context/brand-mark";
import { isCurrent, type Place, placesOf } from "../../__shared_context/places";
import { CONTENT_ID } from "./frame";

const ONCE: AddEventListenerOptions = { once: true };
const LOADING_ROWS = ["work-1", "work-2", "work-3", "connect-1", "connect-2"];

interface ConsoleSidebarProps {
  readonly capabilities: Capabilities | null;
  readonly inProgress: number;
  readonly account: React.ReactNode;
}

export function ConsoleSidebar({
  capabilities,
  inProgress,
  account,
}: ConsoleSidebarProps) {
  const connectLabel = useId();
  const work = placesOf(capabilities, "work");
  const connect = placesOf(capabilities, "connect");
  const settings = placesOf(capabilities, "settings");

  useDrawerClosedOnArrival();

  return (
    <SidebarFrame>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <Places places={work} inProgress={inProgress} />
          </SidebarGroupContent>
        </SidebarGroup>
        {connect.length > 0 && (
          <SidebarGroup role="group" aria-labelledby={connectLabel}>
            <SidebarGroupLabel id={connectLabel}>Connect</SidebarGroupLabel>
            <SidebarSeparator className="mx-0 mb-2 hidden group-data-[collapsible=icon]:block" />
            <SidebarGroupContent>
              <Places places={connect} inProgress={0} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <Places places={settings} inProgress={0} />
        {account !== null && (
          <>
            <SidebarSeparator className="mx-0" />
            {account}
          </>
        )}
      </SidebarFooter>
    </SidebarFrame>
  );
}

export function SidebarLoading() {
  return (
    <SidebarFrame>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {LOADING_ROWS.map((row) => (
              <SidebarMenuItem key={row}>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </SidebarFrame>
  );
}

function SidebarFrame({ children }: { readonly children: React.ReactNode }) {
  return (
    <Sidebar collapsible="icon">
      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col">
        <SidebarHeader className="pt-2.5">
          <Brand />
        </SidebarHeader>
        {children}
      </nav>
      <SidebarRail />
    </Sidebar>
  );
}

function Brand() {
  const leave = useLeaveDrawer();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          tooltip={PRODUCT_NAME}
          className="font-semibold group-data-[collapsible=icon]:p-1! in-data-[mobile=true]:w-[calc(100%-2.5rem)] [&_svg]:size-6!"
        >
          <Link href={HOME_HREF} onClick={leave}>
            <BrandMark />
            <span>{PRODUCT_NAME}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function Places({
  places,
  inProgress,
}: {
  readonly places: readonly Place[];
  readonly inProgress: number;
}) {
  return (
    <SidebarMenu>
      {places.map((place) => {
        const count = place.href === RUNS_HREF ? inProgress : 0;
        return <PlaceItem key={place.href} place={place} count={count} />;
      })}
    </SidebarMenu>
  );
}

function PlaceItem({
  place,
  count,
}: {
  readonly place: Place;
  readonly count: number;
}) {
  const pathname = usePathname();
  const leave = useLeaveDrawer();
  const current = isCurrent(place, pathname);
  const counting = count > 0;
  const Icon = place.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={current} tooltip={place.label}>
        <Link href={place.href} onClick={leave}>
          <Icon />
          <span>{place.label}</span>
          <InProgressSaid count={count} />
          <Pending />
        </Link>
      </SidebarMenuButton>
      {counting && <SidebarMenuBadge aria-hidden>{count}</SidebarMenuBadge>}
    </SidebarMenuItem>
  );
}

function InProgressSaid({ count }: { readonly count: number }) {
  if (count === 0) return null;

  const runs = count === 1 ? "run" : "runs";
  const said = `, ${String(count)} ${runs} in progress now`;

  return <span className="sr-only">{said}</span>;
}

function Pending() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return <Spinner className="ml-auto size-3.5 text-muted-foreground" />;
}

function useLeaveDrawer(): () => void {
  const { isMobile, setOpenMobile, triggerRef } = useSidebar();

  return function leave() {
    if (!isMobile) return;

    triggerRef.current?.addEventListener("focus", focusContent, ONCE);
    setOpenMobile(false);
  };
}

function useDrawerClosedOnArrival() {
  const pathname = usePathname();
  const { openMobile } = useSidebar();
  const leave = useLeaveDrawer();

  const arrive = useEffectEvent(() => {
    if (openMobile) leave();
  });

  useEffect(() => {
    arrive();
  }, [pathname]);
}

function focusContent() {
  document.getElementById(CONTENT_ID)?.focus();
}
