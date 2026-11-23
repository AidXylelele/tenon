"use client";

import { MenuIcon, PanelLeftIcon } from "lucide-react";
import { Button } from "@/libs/ui/components/button";
import { useSidebar } from "@/libs/ui/components/sidebar";

export function NavigationTrigger() {
  const { toggleSidebar, isMobile, open, openMobile, sidebarId, triggerRef } =
    useSidebar();
  const expanded = isMobile ? openMobile : open;
  const reachable = isMobile && openMobile ? -1 : undefined;

  return (
    <Button
      ref={triggerRef}
      aria-expanded={expanded}
      aria-controls={sidebarId}
      tabIndex={reachable}
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      className="focus-visible:bg-hover aria-expanded:bg-transparent aria-expanded:hover:bg-hover aria-expanded:focus-visible:bg-hover"
      onClick={toggleSidebar}
    >
      <MenuIcon className="lg:hidden" />
      <PanelLeftIcon className="max-lg:hidden" />
      <span className="sr-only">Navigation</span>
    </Button>
  );
}
