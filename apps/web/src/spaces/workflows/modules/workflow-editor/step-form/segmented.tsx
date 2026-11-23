"use client";

import type { FormField } from "language-server/protocol";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/libs/ui/components/toggle-group";
import { valueEditsOf } from "../form-fields";
import type { ControlWiring } from "./field-shell";
import { useFormSettings } from "./form-settings";

interface SegmentedProps {
  readonly field: FormField;
  readonly options: readonly {
    readonly value: string;
    readonly text: string;
  }[];
  readonly wiring: ControlWiring;
}

export function Segmented({ field, options, wiring }: SegmentedProps) {
  const { onEdit } = useFormSettings();
  const written = typeof field.value === "string" ? field.value : "";
  const isOffered = options.some((option) => option.value === written);
  const value = isOffered ? written : "";

  function choose(chosen: string) {
    if (chosen === "") return;

    const edits = valueEditsOf(field, chosen);

    onEdit(edits);
  }

  return (
    <div>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={choose}
        aria-labelledby={wiring.labelId}
        aria-describedby={wiring.describedBy}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.text}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
