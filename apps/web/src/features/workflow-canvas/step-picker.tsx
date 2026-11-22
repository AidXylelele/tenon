"use client";

import { useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/libs/ui/components/command";
import {
  familiesOfKinds,
  type KindInfo,
  type StepKind,
} from "@/operations/step-kinds";
import { TaskTile } from "./task-icon";

const FAMILIES = familiesOfKinds();
const KINDS = FAMILIES.flatMap((family) => family.kinds);

interface PickerProps {
  readonly onPick: (kind: StepKind) => void;
}

export function StepPicker({
  open,
  onOpenChange,
  onPick,
}: PickerProps & {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="What happens next?"
      description="Choose the kind of task to add."
    >
      <KindSearch onPick={onPick} />
    </CommandDialog>
  );
}

function KindSearch({ onPick }: PickerProps) {
  const [search, setSearch] = useState("");

  return (
    <Command>
      <CommandInput
        placeholder="Find a kind of task…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No kind of task matches.</CommandEmpty>
        {search === ""
          ? FAMILIES.map((family) => (
              <CommandGroup key={family.family} heading={family.label}>
                {family.kinds.map((info) => (
                  <KindItem key={info.kind} info={info} onPick={onPick} />
                ))}
              </CommandGroup>
            ))
          : KINDS.map((info) => (
              <KindItem key={info.kind} info={info} onPick={onPick} />
            ))}
      </CommandList>
    </Command>
  );
}

function KindItem({ info, onPick }: PickerProps & { readonly info: KindInfo }) {
  return (
    <CommandItem
      value={`${info.kind} ${info.label}`}
      keywords={[info.description]}
      onSelect={() => {
        onPick(info.kind);
      }}
      className="gap-3 py-2"
    >
      <TaskTile kind={info.kind} size="sm" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{info.label}</span>
        <span className="block text-xs text-muted-foreground">
          {info.description}
        </span>
      </span>
    </CommandItem>
  );
}
