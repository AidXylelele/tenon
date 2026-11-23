"use client";

import { BracesIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/libs/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/libs/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/libs/ui/components/popover";
import { useAnnounce } from "@/libs/ui/composites/announcer";
import { choicesOf, type DataChoice } from "./data-choices";
import { ChoiceIcon } from "./choice-icon";
import { ChipWords } from "./data-chip";
import type { DataPick, DataPickerProps } from "./interfaces";

const SEARCH = "Find data, or type a field name";

export function DataPicker({
  data,
  onlyPaths = false,
  label = "Insert data",
  describedBy,
  open,
  onOpenChange,
  onSearch,
  onPick,
  onWriteExpression,
  ref,
}: DataPickerProps) {
  const [opened, setOpened] = useState(false);
  const writing = useRef(false);
  const shown = open ?? opened;

  function change(next: boolean) {
    setOpened(next);
    onOpenChange?.(next);
  }

  function pick(choice: DataChoice) {
    const chosen: DataPick = {
      label: choice.label,
      value: choice.value,
      expression: choice.expression,
      export: choice.export,
      secret: choice.kind === "secret",
    };
    onPick(chosen);
    change(false);
  }

  function writeExpression() {
    writing.current = true;
    change(false);
    onWriteExpression?.();
  }

  function closeFocus(event: Event) {
    if (!writing.current) return;

    writing.current = false;
    event.preventDefault();
  }

  return (
    <Popover open={shown} onOpenChange={change}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          type="button"
          variant="outline"
          className="shrink-0"
          aria-describedby={describedBy}
        >
          <BracesIcon data-icon="inline-start" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(22rem,calc(100vw-16px))] gap-0 p-0"
        aria-label={label}
        onCloseAutoFocus={closeFocus}
      >
        {data === null ? (
          <p className="p-3 text-caption text-muted-foreground">
            Reading the data that reaches this step…
          </p>
        ) : (
          <ChoiceList
            data={data}
            onlyPaths={onlyPaths}
            onSearch={onSearch}
            onPick={pick}
          />
        )}
        <div className="flex items-center gap-2 border-t px-2 py-1.5">
          {onWriteExpression !== undefined && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-1"
              onClick={writeExpression}
            >
              Write an expression
            </Button>
          )}
          <span className="ml-auto text-caption text-muted-foreground">
            Esc closes
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ChoiceList({
  data,
  onlyPaths,
  onSearch,
  onPick,
}: {
  readonly data: NonNullable<DataPickerProps["data"]>;
  readonly onlyPaths: boolean;
  readonly onSearch: DataPickerProps["onSearch"];
  readonly onPick: (choice: DataChoice) => void;
}) {
  const announce = useAnnounce();
  const id = useId();
  const [query, setQuery] = useState("");
  const choices = choicesOf(data, query, onlyPaths);
  const typed = query.trim();
  const groupNotes = choices.groups.flatMap((group) =>
    group.note === null ? [] : [`${group.title}: ${group.note}`],
  );
  const notes = groupNotes.concat(choices.notes);
  const listed = choices.groups.filter((group) => group.choices.length > 0);
  const noteIds = notes.map((_, index) => `${id}-note-${String(index)}`);
  const describedBy = noteIds.length > 0 ? noteIds.join(" ") : undefined;

  function search(next: string) {
    setQuery(next);

    const words = next.trim();
    onSearch?.(words);

    if (words === "") return;

    const found = choicesOf(data, next, onlyPaths);
    const told = foundText(found.count, words);
    announce(told);
  }

  return (
    <Command shouldFilter={false} label={SEARCH}>
      <CommandInput
        placeholder={SEARCH}
        value={query}
        aria-describedby={describedBy}
        onValueChange={search}
      />
      <CommandList className="max-h-80">
        <CommandEmpty>Nothing matches “{typed}”.</CommandEmpty>
        {listed.map((group) => (
          <CommandGroup key={group.id} heading={group.title}>
            {group.choices.map((choice) => (
              <ChoiceItem key={choice.id} choice={choice} onPick={onPick} />
            ))}
          </CommandGroup>
        ))}
      </CommandList>
      {notes.map((note, index) => (
        <p
          key={note}
          id={noteIds[index]}
          className="border-t px-3 py-2 text-caption text-muted-foreground"
        >
          {note}
        </p>
      ))}
    </Command>
  );
}

function foundText(count: number, typed: string): string {
  if (count === 0) return `Nothing matches “${typed}”.`;

  if (count === 1) return "1 piece of data";

  return `${String(count)} pieces of data`;
}

function ChoiceItem({
  choice,
  onPick,
}: {
  readonly choice: DataChoice;
  readonly onPick: (choice: DataChoice) => void;
}) {
  return (
    <CommandItem
      value={choice.id}
      className="data-selected:bg-accent-soft data-selected:text-accent-text"
      onSelect={() => {
        onPick(choice);
      }}
    >
      <ChoiceIcon kind={choice.kind} className="text-muted-foreground" />
      <span className="sr-only">{choice.label}</span>
      <span aria-hidden className="flex min-w-0 flex-1">
        <ChipWords choice={choice} />
      </span>
      <span className="shrink-0 text-caption text-muted-foreground">
        {choice.shape}
      </span>
    </CommandItem>
  );
}
