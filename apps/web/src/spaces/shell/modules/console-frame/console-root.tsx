"use client";

import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { NEW_WORKFLOW_HREF } from "@/libs/routing/routes";
import { SidebarProvider } from "@/libs/ui/components/sidebar";
import { useModalOpen } from "./modal-open";

const COMPACT = "(max-width: 1199px)";
const EDITOR = /^\/workflows\/[^/]+\/[^/]+\/edit$/;

interface ConsoleRootProps {
  readonly defaultOpen: boolean | null;
  readonly children: React.ReactNode;
}

export function ConsoleRoot({ defaultOpen, children }: ConsoleRootProps) {
  const pathname = usePathname();
  const editing = isEditorAddress(pathname);
  const compact = useCompactScreen();
  const modalOpen = useModalOpen();
  const [chosen, setChosen] = useState(defaultOpen);
  const [editorOpen, setEditorOpen] = useState(false);
  const [inEditor, setInEditor] = useState(editing);

  if (inEditor !== editing) {
    setInEditor(editing);
    setEditorOpen(false);
  }

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

function isEditorAddress(pathname: string): boolean {
  return pathname === NEW_WORKFLOW_HREF || EDITOR.test(pathname);
}

function useCompactScreen(): boolean {
  return useSyncExternalStore(subscribe, isCompactNow, isCompactOnServer);
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

function isCompactOnServer(): boolean {
  return false;
}
