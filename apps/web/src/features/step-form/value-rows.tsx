"use client";

import { PlusIcon, XIcon } from "lucide-react";
import type { FormField } from "language-server/protocol";
import { useId, useState } from "react";
import { Button } from "@/libs/ui/components/button";
import {
  FieldDescription,
  FieldError,
  FieldLegend,
  FieldSet,
} from "@/libs/ui/components/field";
import { Input } from "@/libs/ui/components/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/libs/ui/components/tooltip";
import {
  additionOf,
  dataUseOf,
  type FieldWords,
  jsonCommitOf,
  jsonTextOf,
  memberPointerOf,
  removalOf,
  renameCommitOf,
  rowsOf,
  textEditsOf,
  type ValueRow,
} from "@/operations/form-fields";
import {
  FieldShell,
  FieldTitle,
  ProblemLines,
  useFieldProblems,
} from "./field-shell";
import { useFormSettings } from "./form-settings";
import type { DataUse } from "./interfaces";
import { JsonControl } from "./value-controls";

interface ValueRowsProps {
  readonly field: FormField;
  readonly words: FieldWords;
  readonly path: string;
}

interface RowProps {
  readonly holder: FormField;
  readonly row: ValueRow;
  readonly position: number;
}

export function ValueRows({ field, words, path }: ValueRowsProps) {
  const { onEdit } = useFormSettings();
  const problems = useFieldProblems(field, words);
  const rows = rowsOf(field.value);

  if (rows === null)
    return (
      <FieldShell field={field} words={words} path={path} labelsControl>
        {(wiring) => (
          <JsonControl field={field} words={words} wiring={wiring} />
        )}
      </FieldShell>
    );

  function add() {
    const edits = additionOf(field);
    onEdit(edits);
  }

  return (
    <FieldSet className="gap-2" onBlur={problems.leave}>
      <FieldLegend variant="label" className="mb-0">
        <FieldTitle field={field} words={words} path={path} />
      </FieldLegend>
      {words.help !== null && <FieldDescription>{words.help}</FieldDescription>}
      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <ValueRowView
              key={row.name}
              holder={field}
              row={row}
              position={index + 1}
            />
          ))}
        </ul>
      )}
      <ProblemLines problems={problems} />
      <Button
        type="button"
        variant="link"
        size="sm"
        className="self-start px-0"
        onClick={add}
      >
        <PlusIcon data-icon="inline-start" />
        Add a value
      </Button>
    </FieldSet>
  );
}

function ValueRowView({ holder, row, position }: RowProps) {
  const { renderData, onEdit } = useFormSettings();
  const id = useId();
  const valueId = `${id}-value`;
  const errorId = `${id}-error`;
  const [refusal, setRefusal] = useState<string | null>(null);
  const pointer = memberPointerOf(holder.pointer, row.name);
  const member = { pointer, required: true, written: true, value: row.value };
  const isText = typeof row.value === "string" || row.value === null;
  const text = jsonTextOf(row.value);
  const nameLabel = `Name of value ${String(position)}`;
  const valueLabel = `Value of ${row.name}`;
  const removeLabel = `Remove ${row.name}`;
  const invalid = refusal !== null;
  const describedBy = invalid ? errorId : undefined;

  function rename(to: string) {
    const commit = renameCommitOf(holder, row.name, to);

    if (commit.kind === "refused") {
      setRefusal(commit.reason);
      return;
    }

    setRefusal(null);

    onEdit(commit.edits);
  }

  function write(typed: string) {
    const commit = isText
      ? { kind: "edits" as const, edits: textEditsOf(member, typed) }
      : jsonCommitOf(member, typed);

    if (commit.kind === "refused") {
      setRefusal(commit.reason);
      return;
    }

    setRefusal(null);

    onEdit(commit.edits);
  }

  function use(chosen: DataUse) {
    const edits = dataUseOf(pointer, chosen.value, chosen.export);
    onEdit(edits);
  }

  function remove() {
    const edits = removalOf(holder, row.name);
    onEdit(edits);
  }

  const slot = {
    pointer,
    value: row.value,
    inputId: valueId,
    describedBy,
    invalid,
    placeholder: "",
    onText: write,
    onUse: use,
    onClear: () => {
      write("");
    },
  };
  const valueControl =
    renderData === undefined || !isText ? (
      <Input
        key={text}
        id={valueId}
        className="font-mono"
        defaultValue={text}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        onBlur={(event) => {
          write(event.currentTarget.value);
        }}
      />
    ) : (
      renderData(slot)
    );

  return (
    <li className="flex flex-col gap-1">
      <div className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-start gap-2">
        <Input
          key={row.name}
          aria-label={nameLabel}
          defaultValue={row.name}
          aria-describedby={describedBy}
          onBlur={(event) => {
            rename(event.currentTarget.value);
          }}
        />
        <div className="min-w-0">
          <label htmlFor={valueId} className="sr-only">
            {valueLabel}
          </label>
          {valueControl}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={removeLabel}
              onClick={remove}
            >
              <XIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{removeLabel}</TooltipContent>
        </Tooltip>
      </div>
      {invalid && <FieldError id={errorId}>{refusal}</FieldError>}
    </li>
  );
}
