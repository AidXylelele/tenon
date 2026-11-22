"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Capabilities } from "@/libs/data-access/types";
import { heldLeaving } from "@/libs/routing/leaving";
import { Button } from "@/libs/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/libs/ui/components/dialog";
import { Kbd } from "@/libs/ui/components/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/libs/ui/components/tooltip";
import { useHydrated } from "@/libs/ui/hooks/use-hydrated";
import { PaletteContent } from "./palette-content";
import type { KeepTheme } from "./theme-choice";
import { useWorkflowSearch } from "./workflow-results";

interface CommandPaletteProps {
  readonly capabilities: Capabilities | null;
  readonly keepTheme: KeepTheme;
}

export function CommandPalette({
  capabilities,
  keepTheme,
}: CommandPaletteProps) {
  const router = useRouter();
  const workflows = useWorkflowSearch();
  const hydrated = useHydrated();
  const opener = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const shortcut = hydrated ? shortcutHere() : null;

  const toggle = useEffectEvent(() => {
    change(!open);
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const command = event.metaKey || event.ctrlKey;

      if (key !== "k" || !command) return;

      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function change(next: boolean) {
    if (next) {
      opener.current = focusedElement();
      workflows.read();
    }

    setOpen(next);
  }

  function restoreFocus(event: Event) {
    event.preventDefault();
    opener.current?.focus();
  }

  function follow(href: string) {
    setOpen(false);

    if (!heldLeaving(href)) router.push(href);
  }

  return (
    <>
      <SearchButton
        shortcut={shortcut}
        onOpen={() => {
          change(true);
        }}
      />
      <Dialog open={open} onOpenChange={change}>
        <DialogContent
          showCloseButton={false}
          onCloseAutoFocus={restoreFocus}
          aria-describedby={undefined}
          className="top-20 translate-y-0 gap-0 overflow-hidden p-0 data-[size=default]:max-w-[min(600px,calc(100vw-16px))]"
        >
          <DialogTitle className="sr-only">Search and commands</DialogTitle>
          <PaletteContent
            capabilities={capabilities}
            keepTheme={keepTheme}
            workflows={workflows}
            onFollow={follow}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function SearchButton({
  shortcut,
  onOpen,
}: {
  readonly shortcut: string | null;
  readonly onOpen: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          onClick={onOpen}
          aria-keyshortcuts="Meta+K Control+K"
          className="w-60 shrink-0 justify-start px-2.5 font-normal text-muted-foreground max-md:w-8 max-md:justify-center max-md:px-0"
        >
          <SearchIcon />
          <span className="max-md:sr-only">Search</span>
          {shortcut !== null && (
            <Kbd className="ml-auto max-md:hidden" aria-hidden>
              {shortcut}
            </Kbd>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Search pages, workflows and actions</TooltipContent>
    </Tooltip>
  );
}

function focusedElement(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement ? active : null;
}

function shortcutHere(): string {
  const apple = /Mac|iPhone|iPad/.test(navigator.userAgent);
  return apple ? "⌘K" : "Ctrl K";
}
