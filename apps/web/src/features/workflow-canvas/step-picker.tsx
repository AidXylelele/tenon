"use client";

import type { StepVariant } from "language-server/protocol";
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
  startingVariantOf,
} from "@/operations/step-kinds";
import { TaskTile } from "./task-icon";

interface PickerProps {
  readonly onPick: (variant: StepVariant) => void;
}

export function StepPicker({
  open,
  onOpenChange,
  variants,
  onPick,
}: PickerProps & {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly variants: readonly StepVariant[];
}) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="What happens next?"
      description="Choose the kind of task to add."
    >
      <KindSearch variants={variants} onPick={onPick} />
    </CommandDialog>
  );
}

function KindSearch({
  variants,
  onPick,
}: PickerProps & { readonly variants: readonly StepVariant[] }) {
  const [search, setSearch] = useState("");
  const families = familiesOfKinds(variants);
  const kinds = families.flatMap((family) => family.kinds);

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
          ? families.map((family) => (
              <CommandGroup key={family.family} heading={family.label}>
                {family.kinds.map((info) => (
                  <KindItem key={info.kind} info={info} onPick={onPick} />
                ))}
              </CommandGroup>
            ))
          : kinds.map((info) => (
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
        const variant = startingVariantOf(info.kind);
        onPick(variant);
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
