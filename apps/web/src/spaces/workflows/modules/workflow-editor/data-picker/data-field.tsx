"use client";

import { XIcon } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Input } from "@/libs/ui/components/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/libs/ui/components/tooltip";
import { cn } from "@/libs/ui/tokens/cn";
import { choiceOfValue, type DataChoice } from "./data-choices";
import { ChoiceIcon } from "./choice-icon";
import { DataPicker } from "./data-picker";
import type { DataFieldProps, DataPick, Json } from "./interfaces";

const NO_SAMPLES: ReadonlyMap<string, Json> = new Map<string, Json>();

export function DataField({
  value,
  inputId,
  describedBy,
  invalid,
  placeholder,
  onText,
  onUse,
  onClear,
  data,
  samples = NO_SAMPLES,
  onOpenChange,
}: DataFieldProps) {
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const reference =
    writing || data === null ? null : choiceOfValue(value, data, samples);
  const text = typeof value === "string" ? value : "";
  const isExpression = text.startsWith("${");

  function change(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  function use(pick: DataPick) {
    setWriting(false);
    onUse({ value: pick.value, export: pick.export });
  }

  function writeExpression() {
    flushSync(() => {
      setWriting(true);
    });
    input.current?.focus();
  }

  function clear() {
    onClear();
    trigger.current?.focus();
  }

  function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
  }

  return (
    <div className="flex items-start gap-2">
      {reference === null ? (
        <Input
          key={text}
          ref={input}
          id={inputId}
          className={cn(isExpression && "font-mono")}
          placeholder={placeholder}
          defaultValue={text}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          onBlur={(event) => {
            setWriting(false);
            onText(event.currentTarget.value);
          }}
          onKeyDown={blurOnEnter}
        />
      ) : (
        <DataChip
          id={inputId}
          choice={reference}
          describedBy={describedBy}
          onChange={() => {
            change(true);
          }}
          onRemove={clear}
        />
      )}
      <DataPicker
        ref={trigger}
        data={data}
        samples={samples}
        open={open}
        onOpenChange={change}
        onPick={use}
        onWriteExpression={writeExpression}
      />
    </div>
  );
}

function DataChip({
  id,
  choice,
  describedBy,
  onChange,
  onRemove,
}: {
  readonly id: string;
  readonly choice: DataChoice;
  readonly describedBy: string | undefined;
  readonly onChange: () => void;
  readonly onRemove: () => void;
}) {
  const isSecret = choice.kind === "secret";
  const shown = isSecret ? `•••• ${choice.label}` : choice.label;
  const told = isSecret
    ? `${choice.label}, a secret kept out of run records, change`
    : `${choice.label}, change`;
  const removal = `Remove ${choice.label}`;

  return (
    <span className="flex min-h-8 min-w-0 flex-1 items-center gap-1 rounded-full border border-accent-border bg-accent-soft py-0.5 pr-1 pl-2.5 text-accent-text">
      <ChoiceIcon kind={choice.kind} className="size-3.5 shrink-0" />
      <button
        id={id}
        type="button"
        className="min-w-0 truncate rounded-sm text-left text-body"
        aria-label={told}
        aria-describedby={describedBy}
        onClick={onChange}
      >
        {shown}
      </button>
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
    </span>
  );
}
