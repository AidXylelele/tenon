"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
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

interface EventTypePickerProps {
  readonly id: string;
  readonly value: string;
  readonly known: readonly string[];
  readonly onChange: (value: string) => void;
  readonly ref?: React.Ref<HTMLButtonElement>;
}

export function EventTypePicker({
  id,
  value,
  known,
  onChange,
  ref,
}: EventTypePickerProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const trimmed = typed.trim();
  const offersTyped = trimmed !== "" && !known.includes(trimmed);
  const useTyped = `Use “${trimmed}”`;

  function choose(next: string) {
    onChange(next);
    setTyped("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-mono font-normal"
        >
          <span className="truncate">{value}</span>
          <ChevronDownIcon className="text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <Command>
          <CommandInput
            value={typed}
            onValueChange={setTyped}
            placeholder="Find or type an event type"
          />
          <CommandList>
            <CommandEmpty>Type the event type to send.</CommandEmpty>
            {offersTyped && (
              <CommandGroup>
                <CommandItem
                  value={trimmed}
                  onSelect={() => {
                    choose(trimmed);
                  }}
                >
                  {useTyped}
                </CommandItem>
              </CommandGroup>
            )}
            {known.length > 0 && (
              <CommandGroup heading="Your webhooks">
                {known.map((each) => (
                  <CommandItem
                    key={each}
                    value={each}
                    onSelect={() => {
                      choose(each);
                    }}
                    className="font-mono"
                  >
                    {each}
                    {each === value && <CheckIcon className="ml-auto" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
