"use client";

import { XIcon } from "lucide-react";
import { useId } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/libs/ui/components/tooltip";
import { cn } from "@/libs/ui/tokens/cn";
import { ChoiceIcon } from "./choice-icon";
import type { DataChoice } from "./data-choices";

interface DataChipProps {
  readonly choice: DataChoice;
  readonly id?: string;
  readonly labelId?: string;
  readonly describedBy?: string;
  readonly onChange?: () => void;
  readonly onRemove?: () => void;
}

const CHIP =
  "flex min-h-8 min-w-0 items-center gap-1 rounded-full border border-accent-border bg-accent-soft py-0.5 pr-1 pl-2.5 text-accent-text";

export function DataChip({
  choice,
  id,
  labelId,
  describedBy,
  onChange,
  onRemove,
}: DataChipProps) {
  const textId = useId();
  const isSecret = choice.kind === "secret";
  const told = isSecret
    ? `${choice.label}, a secret kept out of run records`
    : choice.label;
  const changing = onChange === undefined ? told : `${told}, change`;
  const labelledBy = labelId === undefined ? textId : `${labelId} ${textId}`;
  const removal = `Remove ${choice.label}`;
  const words = <ChipWords choice={choice} />;

  return (
    <span className={CHIP}>
      <ChoiceIcon kind={choice.kind} className="size-3.5 shrink-0" />
      {onChange === undefined ? (
        <span className="flex min-w-0 text-body">
          <span className="sr-only">{told}</span>
          <span aria-hidden className="flex min-w-0">
            {words}
          </span>
        </span>
      ) : (
        <button
          id={id}
          type="button"
          className="flex min-h-6 min-w-12 items-center rounded-sm text-left text-body"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          onClick={onChange}
        >
          <span id={textId} className="sr-only">
            {changing}
          </span>
          <span aria-hidden className="flex min-w-0">
            {words}
          </span>
        </button>
      )}
      {onRemove !== undefined && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="ml-auto grid size-6 shrink-0 place-items-center rounded-full hover:bg-accent-soft-hover"
              aria-label={removal}
              onClick={onRemove}
            >
              <XIcon className="size-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent>{removal}</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

export function ChipWords({ choice }: { readonly choice: DataChoice }) {
  const isSecret = choice.kind === "secret";
  const name = isSecret ? `•••• ${choice.name}` : choice.name;
  const gap = choice.owner === "" ? "" : "pl-1";

  return (
    <>
      <span className="min-w-0 shrink-[100] truncate">{choice.owner}</span>
      <span className={cn("min-w-0 truncate", gap)}>{name}</span>
    </>
  );
}
