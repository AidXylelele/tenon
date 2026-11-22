"use client";

import { BracesIcon } from "lucide-react";
import { useRef, useState } from "react";
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
import type { DataPick, DataPickerProps, Json } from "./interfaces";

const SEARCH = "Find data, or type a field name";

const NO_SAMPLES: ReadonlyMap<string, Json> = new Map<string, Json>();

export function DataPicker({
  data,
  samples = NO_SAMPLES,
  onlyPaths = false,
  label = "Insert data",
  open,
  onOpenChange,
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
        <Button ref={ref} type="button" variant="outline" className="shrink-0">
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
            samples={samples}
            onlyPaths={onlyPaths}
            onPick={pick}
          />
        )}
        <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5">
          {onWriteExpression !== undefined ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-1"
              onClick={writeExpression}
            >
              Write an expression
            </Button>
          ) : (
            <span />
          )}
          <span className="text-caption text-muted-foreground">Esc closes</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ChoiceList({
  data,
  samples,
  onlyPaths,
  onPick,
}: {
  readonly data: NonNullable<DataPickerProps["data"]>;
  readonly samples: NonNullable<DataPickerProps["samples"]>;
  readonly onlyPaths: boolean;
  readonly onPick: (choice: DataChoice) => void;
}) {
  const announce = useAnnounce();
  const [query, setQuery] = useState("");
  const choices = choicesOf(data, samples, query, onlyPaths);
  const typed = query.trim();

  function search(next: string) {
    setQuery(next);

    const words = next.trim();

    if (words === "") return;

    const found = choicesOf(data, samples, next, onlyPaths);
    const told = foundText(found.count, words);
    announce(told);
  }

  return (
    <Command shouldFilter={false} label={SEARCH}>
      <CommandInput placeholder={SEARCH} value={query} onValueChange={search} />
      <CommandList className="max-h-80">
        <CommandEmpty>Nothing matches “{typed}”.</CommandEmpty>
        {choices.groups.map((group) => (
          <CommandGroup key={group.id} heading={group.title}>
            {group.choices.map((choice) => (
              <ChoiceItem key={choice.id} choice={choice} onPick={onPick} />
            ))}
            {group.note !== null && (
              <p className="px-2 pb-1.5 text-caption text-muted-foreground">
                {group.note}
              </p>
            )}
          </CommandGroup>
        ))}
      </CommandList>
      {choices.notes.map((note) => (
        <p
          key={note}
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
      onSelect={() => {
        onPick(choice);
      }}
    >
      <ChoiceIcon kind={choice.kind} className="text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{choice.label}</span>
      <span className="shrink-0 text-caption text-muted-foreground">
        {choice.shape}
      </span>
    </CommandItem>
  );
}
