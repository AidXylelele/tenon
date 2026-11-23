"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { isEditorPath } from "@/libs/routing/routes";
import { SidebarProvider } from "@/libs/ui/components/sidebar";
import { YEAR_S } from "./cookie-age";
import { useModalOpen } from "./modal-open";
import { type Viewport, VIEWPORT_COOKIE } from "./viewport";

const COMPACT = "(max-width: 1199px)";

interface ConsoleRootProps {
  readonly defaultOpen: boolean | null;
  readonly lastViewport: Viewport | null;
  readonly children: React.ReactNode;
}

export function ConsoleRoot({
  defaultOpen,
  lastViewport,
  children,
}: ConsoleRootProps) {
  const pathname = usePathname();
  const editing = isEditorPath(pathname);
  const lastCompact = lastViewport === "narrow";
  const compact = useCompactScreen(lastCompact);
  const modalOpen = useModalOpen();
  const [chosen, setChosen] = useState(defaultOpen);
  const [editorOpen, setEditorOpen] = useState(false);
  const [inEditor, setInEditor] = useState(editing);

  if (inEditor !== editing) {
    setInEditor(editing);
    setEditorOpen(false);
  }

  useEffect(() => {
    const viewport = compact ? "narrow" : "wide";
    document.cookie = `${VIEWPORT_COOKIE}=${viewport}; path=/; max-age=${String(YEAR_S)}; samesite=lax`;
  }, [compact]);

  const columnOpen = chosen ?? !compact;
  const open = editing ? editorOpen : columnOpen;

  function change(next: boolean) {
    setChosen(next);
    setEditorOpen(next);
  }

  return (
    <SidebarProvider open={open} onOpenChange={change} inert={modalOpen}>
      {children}
    </SidebarProvider>
  );
}

function useCompactScreen(lastCompact: boolean): boolean {
  return useSyncExternalStore(subscribe, isCompactNow, () => lastCompact);
}

function subscribe(listener: () => void): () => void {
  const query = window.matchMedia(COMPACT);
  query.addEventListener("change", listener);
  return () => {
    query.removeEventListener("change", listener);
  };
}

function isCompactNow(): boolean {
  return window.matchMedia(COMPACT).matches;
}
