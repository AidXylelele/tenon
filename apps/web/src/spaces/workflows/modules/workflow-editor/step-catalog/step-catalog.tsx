"use client";

import { ChevronDownIcon } from "lucide-react";
import { type JSX, useRef, useState } from "react";
import { Button } from "@/libs/ui/components/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/libs/ui/components/command";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/libs/ui/components/empty";
import { useAnnounce } from "@/libs/ui/composites/announcer";
import { cn } from "@/libs/ui/tokens/cn";
import { catalogOf, entryWordsOf } from "./catalog";
import { ENTRY_ICONS } from "./entry-icons";
import type {
  EntryAction,
  GroupId,
  ShownEntry,
  ShownGroup,
  StepCatalogProps,
} from "./interfaces";
import { foundText, keyboardOrderOf, noMatchOf, shownGroupsOf } from "./search";

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
  languageTerms,
  onChoose,
}: StepCatalogProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState(NONE_OPENED);
  const searchBox = useRef<HTMLInputElement>(null);
  const announce = useAnnounce();

  const catalog = catalogOf(variants, stepAbove);
  const groups = shownGroupsOf(catalog, query, opened);
  const open = groups.filter((group) => group.open);
  const closed = groups.filter((group) => !group.open);
  const someClosed = closed.length > 0;
  const nothingMatches = groups.length === 0;

  function search(typed: string): void {
    setQuery(typed);
    const isSearching = typed.trim() !== "";

    if (!isSearching) return;

    const found = shownGroupsOf(catalog, typed, opened);
    const count = keyboardOrderOf(found).length;
    const said = foundText(count);
    announce(said);
  }

  function openGroup(id: GroupId): void {
    const next = new Set(opened);
    next.add(id);
    setOpened(next);
    searchBox.current?.focus();
  }

  return (
    <div className="flex flex-col gap-3">
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
          onValueChange={search}
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
    <Button
      type="button"
      variant="ghost"
      aria-expanded={false}
      onClick={open}
      className="h-auto w-full justify-between px-0 py-1.5 text-caption font-semibold tracking-caps text-muted-foreground uppercase hover:bg-transparent hover:text-foreground active:bg-transparent"
    >
      {group.title}
      <span className="flex items-center gap-1">
        <span aria-hidden>{count}</span>
        <span className="sr-only">{counted}</span>
        <ChevronDownIcon aria-hidden />
      </span>
    </Button>
  );
}

function NoMatchNote({ query }: NoMatchProps) {
  const note = noMatchOf(query);

  return (
    <Empty role="note" className="gap-1 px-2 py-6">
      <EmptyHeader>
        <EmptyTitle className="font-normal">{note.message}</EmptyTitle>
        <EmptyDescription className="text-caption">
          {note.hint}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
