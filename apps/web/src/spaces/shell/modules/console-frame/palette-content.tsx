"use client";

import { useCommandState } from "cmdk";
import {
  ActivityIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CornerDownLeftIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
} from "lucide-react";
import { useState } from "react";
import type { Capabilities } from "@/libs/data-access/types";
import { editorHref, runHref, workflowHref } from "@/libs/routing/routes";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/libs/ui/components/command";
import { Kbd } from "@/libs/ui/components/kbd";
import { useColorScheme } from "@/libs/ui/hooks/use-color-scheme";
import { allowedOf, pagesOf, placeOf } from "../../__shared_context/places";
import type { FoundWorkflow } from "./found-workflow";
import { ACTIONS, type PaletteAction } from "./palette-actions";
import { remember, useRecent, type Visit } from "./recent";
import { type KeepTheme, useThemeChoice } from "./theme-choice";
import {
  isFirstRead,
  type WorkflowSearch,
  WorkflowResults,
  workflowValueOf,
} from "./workflow-results";

type View = "everything" | "run";

type Scheme = "light" | "dark";

const RUN_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUN_ID_SHOWN = 8;
const PROMPT = "Search pages, workflows, actions and run IDs";
const RUN_PROMPT = "Which workflow to run?";

interface PaletteContentProps {
  readonly capabilities: Capabilities | null;
  readonly keepTheme: KeepTheme;
  readonly workflows: WorkflowSearch;
  readonly onFollow: (href: string) => void;
}

export function PaletteContent({
  capabilities,
  keepTheme,
  workflows,
  onFollow,
}: PaletteContentProps) {
  const scheme = useColorScheme();
  const { choose } = useThemeChoice(keepTheme);
  const recent = useRecent();
  const [view, setView] = useState<View>("everything");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");

  const author = capabilities?.author === true;
  const searching = query !== "";
  const firstRead = isFirstRead(workflows);
  const settled = searching && !firstRead;
  const looksLikeRun = RUN_ID.test(query);
  const runId = looksLikeRun ? query : null;
  const pages = pagesOf(capabilities);
  const actions = allowedOf(ACTIONS, capabilities);
  const prompt = view === "run" ? RUN_PROMPT : PROMPT;

  function visit(visited: Visit) {
    remember(visited);
    onFollow(visited.href);
  }

  function chooseWorkflow(workflow: FoundWorkflow) {
    const start = view === "run";
    const href = workflowHref(workflow.namespace, workflow.name, { start });
    const visited = { label: workflow.name, href };

    if (start) onFollow(href);
    else visit(visited);
  }

  function act(action: PaletteAction) {
    switch (action.kind) {
      case "link":
        onFollow(action.href);
        return;
      case "run":
        setView("run");
        setQuery("");
        return;
      case "theme": {
        const next = oppositeOf(scheme);
        choose(next);
        return;
      }
    }
  }

  function keyDown(event: React.KeyboardEvent) {
    const backOut = view === "run" && event.key === "Backspace" && !searching;
    const command = event.metaKey || event.ctrlKey;
    const toEditor = author && event.key === "Enter" && command;

    if (backOut) {
      event.preventDefault();
      setView("everything");
      return;
    }

    if (!toEditor) return;

    const chosen = workflows.found?.find((each) => {
      const value = workflowValueOf(each);
      return value === selected;
    });

    if (chosen === undefined) return;

    event.preventDefault();
    const href = editorHref(chosen.namespace, chosen.name);
    onFollow(href);
  }

  return (
    <>
      <Command
        label={prompt}
        value={selected}
        onValueChange={setSelected}
        onKeyDown={keyDown}
        className="rounded-none! p-0"
      >
        <CommandInput
          placeholder={prompt}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList label="Results" className="max-h-96 p-1">
          {settled && (
            <CommandEmpty>
              Nothing matches “{query}”. Try a workflow&apos;s name, a page, an
              action or a run ID.
            </CommandEmpty>
          )}
          {view === "run" ? (
            <WorkflowResults search={workflows} onChoose={chooseWorkflow} />
          ) : (
            <>
              {!searching && <RecentGroup recent={recent} onVisit={visit} />}
              {runId !== null && <RunGroup id={runId} onVisit={visit} />}
              {searching && (
                <WorkflowResults search={workflows} onChoose={chooseWorkflow} />
              )}
              <CommandGroup heading="Go to">
                {pages.map((page) => {
                  const Icon = page.icon;
                  const visited = { label: page.label, href: page.href };
                  return (
                    <CommandItem
                      key={page.href}
                      onSelect={() => {
                        visit(visited);
                      }}
                    >
                      <Icon />
                      {page.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandGroup heading="Actions">
                {actions.map((action) => {
                  const label = labelOf(action, scheme);
                  const Icon = iconOf(action, scheme);
                  return (
                    <CommandItem
                      key={label}
                      onSelect={() => {
                        act(action);
                      }}
                    >
                      <Icon />
                      {label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
        <ResultCount speaking={settled} />
      </Command>
      <p className="flex items-center gap-1.5 border-t px-3 py-2 text-caption text-muted-foreground">
        <Kbd>
          <ArrowUpIcon />
          <ArrowDownIcon />
          <span className="sr-only">Up or down arrow</span>
        </Kbd>
        move
        <Kbd>
          <CornerDownLeftIcon />
          <span className="sr-only">Enter</span>
        </Kbd>
        open
        <Kbd>esc</Kbd>
        close
      </p>
    </>
  );
}

function RecentGroup({
  recent,
  onVisit,
}: {
  readonly recent: readonly Visit[];
  readonly onVisit: (visit: Visit) => void;
}) {
  if (recent.length === 0) return null;

  return (
    <CommandGroup heading="Recent">
      {recent.map((visited) => {
        const value = `recent ${visited.href}`;
        const place = placeOf(visited.href);
        const Icon = place?.icon ?? SearchIcon;
        return (
          <CommandItem
            key={value}
            value={value}
            onSelect={() => {
              onVisit(visited);
            }}
          >
            <Icon />
            {visited.label}
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}

function RunGroup({
  id,
  onVisit,
}: {
  readonly id: string;
  readonly onVisit: (visit: Visit) => void;
}) {
  const shown = id.slice(0, RUN_ID_SHOWN);
  const label = `Run ${shown}`;
  const href = runHref(id);
  const visited = { label, href };

  return (
    <CommandGroup heading="Runs">
      <CommandItem
        value={id}
        onSelect={() => {
          onVisit(visited);
        }}
      >
        <ActivityIcon />
        {label}
      </CommandItem>
    </CommandGroup>
  );
}

function ResultCount({ speaking }: { readonly speaking: boolean }) {
  const count = useCommandState((state) => state.filtered.count);
  const results = count === 1 ? "1 result" : `${String(count)} results`;
  const said = count === 0 ? "Nothing matches" : results;

  return (
    <p role="status" className="sr-only">
      {speaking && said}
    </p>
  );
}

function labelOf(action: PaletteAction, scheme: Scheme): string {
  switch (action.kind) {
    case "link":
    case "run":
      return action.label;
    case "theme": {
      const next = oppositeOf(scheme);
      return `Switch to the ${next} theme`;
    }
  }
}

function iconOf(action: PaletteAction, scheme: Scheme) {
  switch (action.kind) {
    case "link":
    case "run":
      return action.icon;
    case "theme":
      return scheme === "dark" ? SunIcon : MoonIcon;
  }
}

function oppositeOf(scheme: Scheme): Scheme {
  return scheme === "dark" ? "light" : "dark";
}
