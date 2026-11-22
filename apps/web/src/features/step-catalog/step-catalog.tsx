"use client";

import { ChevronDownIcon, XIcon } from "lucide-react";
import { type JSX, useId, useRef, useState } from "react";
import { Button } from "@/libs/ui/components/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/libs/ui/components/command";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/libs/ui/components/tooltip";
import { cn } from "@/libs/ui/tokens/cn";
import {
  catalogOf,
  type EntryAction,
  entryWordsOf,
  foundText,
  type GroupId,
  keyboardOrderOf,
  noMatchOf,
  type ShownEntry,
  type ShownGroup,
  shownGroupsOf,
} from "@/operations/step-catalog";
import { ENTRY_ICONS } from "./entry-icons";
import type { StepCatalogProps } from "./interfaces";

interface HeaderProps {
  readonly titleId: string;
  readonly place: string;
  readonly onClose: () => void;
}

interface OptionProps {
  readonly shown: ShownEntry;
  readonly stepAbove: string | null;
  readonly languageTerms: boolean;
  readonly onChoose: (action: EntryAction) => void;
}

interface ClosedGroupProps {
  readonly group: ShownGroup;
  readonly onOpen: (id: GroupId) => void;
}

interface NoMatchProps {
  readonly query: string;
}

const NONE_OPENED: ReadonlySet<GroupId> = new Set();

const TERM_SHOWN = "inline";

const TERM_ON_HOVER_OR_ACTIVE =
  "hidden group-hover/command-item:inline group-data-[selected=true]/command-item:inline";

export function StepCatalog({
  variants,
  stepAbove,
  place,
  languageTerms,
  onChoose,
  onClose,
}: StepCatalogProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState(NONE_OPENED);
  const searchBox = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const catalog = catalogOf(variants, stepAbove);
  const groups = shownGroupsOf(catalog, query, opened);
  const order = keyboardOrderOf(groups);
  const open = groups.filter((group) => group.open);
  const closed = groups.filter((group) => !group.open);
  const someClosed = closed.length > 0;
  const searching = query.trim() !== "";
  const found = foundText(order.length);
  const said = searching ? found : "";
  const nothingMatches = groups.length === 0;

  function openGroup(id: GroupId): void {
    const next = new Set(opened);
    next.add(id);
    setOpened(next);
    searchBox.current?.focus();
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col">
      <CatalogHeader titleId={titleId} place={place} onClose={onClose} />
      <div className="flex flex-col gap-3 p-4">
        <Command
          shouldFilter={false}
          disablePointerSelection
          label="Find a kind of step"
          className="size-auto gap-3 overflow-visible rounded-none! bg-transparent p-0"
        >
          <CommandInput
            ref={searchBox}
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Find a step: http, slack, if, loop, wait…"
          />
          <CommandList
            label="Kinds of step"
            hidden={nothingMatches}
            className="max-h-none overflow-visible *:[[cmdk-list-sizer]]:flex *:[[cmdk-list-sizer]]:flex-col *:[[cmdk-list-sizer]]:gap-2"
          >
            {open.map((group) => (
              <CommandGroup
                key={group.id}
                heading={group.title}
                className="p-0 **:[[cmdk-group-heading]]:px-0 **:[[cmdk-group-heading]]:py-1 **:[[cmdk-group-heading]]:tracking-caps **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-items]]:flex **:[[cmdk-group-items]]:flex-col **:[[cmdk-group-items]]:gap-0.5"
              >
                {group.entries.map((shown) => (
                  <CatalogOption
                    key={shown.entry.id}
                    shown={shown}
                    stepAbove={stepAbove}
                    languageTerms={languageTerms}
                    onChoose={onChoose}
                  />
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        {someClosed ? (
          <div className="flex flex-col gap-0.5">
            {closed.map((group) => (
              <ClosedGroup key={group.id} group={group} onOpen={openGroup} />
            ))}
          </div>
        ) : null}
        {nothingMatches ? <NoMatchNote query={query} /> : null}
      </div>
      <p role="status" className="sr-only">
        {said}
      </p>
    </section>
  );
}

function CatalogHeader({ titleId, place, onClose }: HeaderProps) {
  return (
    <header className="flex items-start gap-2 border-b px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 id={titleId} className="heading-2">
          Add a step
        </h2>
        <p className="text-caption text-muted-foreground">{place}</p>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={onClose}
          >
            <XIcon aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Close</TooltipContent>
      </Tooltip>
    </header>
  );
}

function CatalogOption({
  shown,
  stepAbove,
  languageTerms,
  onChoose,
}: OptionProps) {
  const { entry, termMatched } = shown;
  const words = entryWordsOf(entry, stepAbove);
  const Icon = ENTRY_ICONS[entry.icon];
  const termAlwaysShown = languageTerms || termMatched;
  const termShown = termAlwaysShown ? TERM_SHOWN : TERM_ON_HOVER_OR_ACTIVE;
  const termLook = cn(
    "font-mono text-caption font-normal text-muted-foreground",
    termShown,
  );

  function choose(): void {
    onChoose(entry.action);
  }

  return (
    <CommandItem
      value={entry.id}
      onSelect={choose}
      tabIndex={-1}
      className="cursor-pointer items-start gap-2.5 rounded-md p-2 text-body hover:bg-hover data-selected:bg-hover data-selected:shadow-[inset_3px_0_0_var(--accent-solid),inset_0_0_0_2px_var(--focus-ring)] forced-colors:data-selected:outline-2 forced-colors:data-selected:outline-solid"
    >
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-md border bg-subtle text-muted-foreground"
      >
        <Icon />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{words.title}</span>
          <code className={termLook}>{entry.languageTerm}</code>
        </span>
        <span className="text-caption text-muted-foreground">
          {words.description}
        </span>
        <span className="truncate text-caption text-muted-foreground">
          {entry.example}
        </span>
      </span>
    </CommandItem>
  );
}

function ClosedGroup({ group, onOpen }: ClosedGroupProps) {
  const count = group.entries.length;
  const found = foundText(count);
  const counted = `, ${found}`;

  function open(): void {
    onOpen(group.id);
  }

  return (
    <button
      type="button"
      aria-expanded={false}
      onClick={open}
      className="flex w-full items-center justify-between py-1.5 caps text-muted-foreground hover:text-foreground"
    >
      {group.title}
      <span className="flex items-center gap-1">
        <span aria-hidden>{count}</span>
        <span className="sr-only">{counted}</span>
        <ChevronDownIcon aria-hidden className="size-4" />
      </span>
    </button>
  );
}

function NoMatchNote({ query }: NoMatchProps) {
  const note = noMatchOf(query);

  return (
    <div role="note" className="flex flex-col gap-1 px-2 py-6 text-center">
      <p>{note.message}</p>
      <p className="text-caption text-muted-foreground">{note.hint}</p>
    </div>
  );
}
