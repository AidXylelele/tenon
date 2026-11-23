"use client";

import { XIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Input } from "@/libs/ui/components/input";
import { Textarea } from "@/libs/ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/libs/ui/components/tooltip";
import { blurOnEnter } from "../step-form";
import { choiceOfValue, type DataChoice, NO_SAMPLES } from "./data-choices";
import { ChoiceIcon } from "./choice-icon";
import { DataPicker } from "./data-picker";
import type { DataFieldProps, DataPick } from "./interfaces";

export function DataField({
  value,
  inputId,
  labelId,
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
  const input = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const reference =
    writing || data === null ? null : choiceOfValue(value, data, samples);
  const text = typeof value === "string" ? value : "";
  const isExpression = writing || text.startsWith("${");

  function change(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  function use(pick: DataPick) {
    const chosen = { value: pick.value, export: pick.export };
    setWriting(false);
    onUse(chosen);
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

  function commit(typed: string) {
    setWriting(false);

    if (typed !== text) onText(typed);
  }

  const shared = {
    ref: input,
    id: inputId,
    placeholder,
    defaultValue: text,
    "aria-describedby": describedBy,
    "aria-invalid": invalid,
  };

  return (
    <div className="flex items-start gap-2">
      {reference === null && isExpression && (
        <Textarea
          key={text}
          {...shared}
          rows={1}
          spellCheck={false}
          className="font-mono"
          onBlur={(event) => {
            commit(event.currentTarget.value);
          }}
        />
      )}
      {reference === null && !isExpression && (
        <Input
          key={text}
          {...shared}
          onBlur={(event) => {
            commit(event.currentTarget.value);
          }}
          onKeyDown={blurOnEnter}
        />
      )}
      {reference !== null && (
        <DataChip
          id={inputId}
          labelId={labelId}
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
        describedBy={labelId}
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
  labelId,
  choice,
  describedBy,
  onChange,
  onRemove,
}: {
  readonly id: string;
  readonly labelId: string;
  readonly choice: DataChoice;
  readonly describedBy: string | undefined;
  readonly onChange: () => void;
  readonly onRemove: () => void;
}) {
  const textId = useId();
  const isSecret = choice.kind === "secret";
  const shown = isSecret ? `•••• ${choice.label}` : choice.label;
  const told = isSecret
    ? `${choice.label}, a secret kept out of run records, change`
    : `${choice.label}, change`;
  const labelledBy = `${labelId} ${textId}`;
  const removal = `Remove ${choice.label}`;

  return (
    <span className="flex min-h-8 min-w-0 flex-1 items-center gap-1 rounded-full border border-accent-border bg-accent-soft py-0.5 pr-1 pl-2.5 text-accent-text">
      <ChoiceIcon kind={choice.kind} className="size-3.5 shrink-0" />
      <button
        id={id}
        type="button"
        className="min-w-0 truncate rounded-sm text-left text-body"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onClick={onChange}
      >
        <span aria-hidden>{shown}</span>
        <span id={textId} className="sr-only">
          {told}
        </span>
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
