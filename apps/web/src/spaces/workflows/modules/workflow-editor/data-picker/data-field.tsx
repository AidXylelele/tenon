"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Input } from "@/libs/ui/components/input";
import { Textarea } from "@/libs/ui/components/textarea";
import { blurOnEnter } from "../step-form";
import { DataChip } from "./data-chip";
import { choiceOfValue } from "./data-choices";
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
  onOpenChange,
}: DataFieldProps) {
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const input = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const reference =
    writing || data === null ? null : choiceOfValue(value, data);
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
        <div className="flex min-w-0 flex-1">
          <DataChip
            key={reference.id}
            id={inputId}
            labelId={labelId}
            choice={reference}
            describedBy={describedBy}
            onChange={() => {
              change(true);
            }}
            onRemove={clear}
          />
        </div>
      )}
      <DataPicker
        ref={trigger}
        data={data}
        describedBy={labelId}
        open={open}
        onOpenChange={change}
        onPick={use}
        onWriteExpression={writeExpression}
      />
    </div>
  );
}
