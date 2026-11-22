"use client";

import { PlusIcon, SearchIcon, SendIcon, WebhookIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";
import type { Session } from "@/libs/data-access/types";
import { heldLeaving } from "@/libs/routing/leaving";
import {
  NEW_WORKFLOW_HREF,
  TEST_EVENT_HREF,
  WEBHOOKS_HREF,
} from "@/libs/routing/routes";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/libs/ui/components/command";
import { Kbd } from "@/libs/ui/components/kbd";
import { useHydrated } from "@/libs/ui/hooks/use-hydrated";
import { pagesOf } from "./destinations";
import { useWorkflowSearch, WorkflowResults } from "./workflow-results";

export function CommandPalette({
  session,
}: {
  readonly session: Session | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const workflows = useWorkflowSearch();
  const author = session?.capabilities.author === true;
  const hydrated = useHydrated();
  const shortcut = hydrated ? shortcutHere() : null;

  const toggle = useEffectEvent(() => {
    change(!open);
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey))
        return;

      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function change(next: boolean) {
    setOpen(next);

    if (next) workflows.read();
  }

  function go(href: string) {
    setOpen(false);

    if (!heldLeaving(href)) router.push(href);
  }

  const pages = pagesOf(session?.capabilities ?? null);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          change(true);
        }}
        className="flex h-8 w-full max-w-md min-w-0 items-center gap-2 rounded-lg border border-input bg-background px-2.5 text-sm text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-muted"
      >
        <SearchIcon className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate text-left">
          Search workflows and pages
        </span>
        {shortcut !== null && (
          <Kbd className="hidden sm:inline-flex" aria-hidden>
            {shortcut}
          </Kbd>
        )}
      </button>
      <CommandDialog
        open={open}
        onOpenChange={change}
        title="Search"
        description="Search workflows, pages and actions"
      >
        <Command>
          <CommandInput placeholder="Type a workflow, a page or an action…" />
          <CommandList>
            <CommandEmpty>Nothing matches.</CommandEmpty>
            {author && (
              <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={() => {
                    go(NEW_WORKFLOW_HREF);
                  }}
                >
                  <PlusIcon />
                  New workflow
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    go(WEBHOOKS_HREF);
                  }}
                >
                  <WebhookIcon />
                  New webhook
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    go(TEST_EVENT_HREF);
                  }}
                >
                  <SendIcon />
                  Send a test event
                </CommandItem>
              </CommandGroup>
            )}
            <WorkflowResults search={workflows} onGo={go} />
            <CommandSeparator />
            <CommandGroup heading="Pages">
              {pages.map((page) => {
                const Icon = page.icon;
                return (
                  <CommandItem
                    key={page.href}
                    onSelect={() => {
                      go(page.href);
                    }}
                  >
                    <Icon />
                    {page.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

function shortcutHere(): string {
  const apple = /Mac|iPhone|iPad/.test(navigator.userAgent);
  return apple ? "⌘K" : "Ctrl K";
}
