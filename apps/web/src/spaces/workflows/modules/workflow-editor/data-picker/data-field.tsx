"use client";

import type { TemplatePart } from "language-server/protocol";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Input } from "@/libs/ui/components/input";
import { Textarea } from "@/libs/ui/components/textarea";
import { cn } from "@/libs/ui/tokens/cn";
import { blurOnEnter } from "../step-form";
import { DataChip } from "./data-chip";
import { choiceOfValue } from "./data-choices";
import { DataPicker } from "./data-picker";
import type { DataFieldProps, DataPick } from "./interfaces";
import { TemplateField } from "./template-field";
import { textPartOf } from "./template-text";

const TYPED = "w-auto min-w-0 grow basis-40 placeholder:text-faint";

export function DataField({
  value,
  inputId,
  labelId,
  describedBy,
  invalid,
  placeholder,
  onText,
  onUse,
  onTemplate,
  onClear,
  data,
  template = null,
  onOpenChange,
  onSearch,
}: DataFieldProps) {
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const input = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const reference =
    writing || data === null ? null : choiceOfValue(value, data);
  const text = typeof value === "string" ? value : "";
  const isExpression = writing || template?.kind === "expression";
  const parts = template?.kind === "template" ? template.parts : [];
  const isMixed = parts.length > 1;

  function change(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  function use(pick: DataPick) {
    const chosen = { value: pick.value, export: pick.export };
    const typed = input.current?.value ?? "";
    const isText = reference === null && !isExpression && typed !== "";
    setWriting(false);

    if (!isText) {
      onUse(chosen);
      return;
    }

    const caret = input.current?.selectionStart ?? typed.length;
    const before = typed.slice(0, caret);
    const after = typed.slice(caret);
    const inserted: TemplatePart = {
      kind: "data",
      expression: pick.expression,
      label: pick.label,
    };
    const around = [textPartOf(before), [inserted], textPartOf(after)];
    onTemplate(around.flat(), chosen);
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

  if (isMixed && !writing)
    return (
      <TemplateField
        key={JSON.stringify(parts)}
        parts={parts}
        data={data}
        inputId={inputId}
        labelId={labelId}
        describedBy={describedBy}
        invalid={invalid}
        onTemplate={onTemplate}
        onSearch={onSearch}
      />
    );

  return (
    <div className="flex flex-wrap items-start gap-2">
      {reference === null && isExpression && (
        <Textarea
          key={text}
          {...shared}
          rows={1}
          spellCheck={false}
          className={cn(TYPED, "font-mono")}
          onBlur={(event) => {
            commit(event.currentTarget.value);
          }}
        />
      )}
      {reference === null && !isExpression && (
        <Input
          key={text}
          {...shared}
          className={TYPED}
          onBlur={(event) => {
            commit(event.currentTarget.value);
          }}
          onKeyDown={blurOnEnter}
        />
      )}
      {reference !== null && (
        <div className="flex min-w-0 grow basis-40">
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
        onSearch={onSearch}
        onPick={use}
        onWriteExpression={writeExpression}
      />
    </div>
  );
}
