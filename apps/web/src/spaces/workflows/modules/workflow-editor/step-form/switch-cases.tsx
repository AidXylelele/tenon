"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  EllipsisIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import type { FormField } from "language-server/protocol";
import { useId } from "react";
import { Button } from "@/libs/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/libs/ui/components/dropdown-menu";
import { Field, FieldLabel } from "@/libs/ui/components/field";
import { Input } from "@/libs/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/libs/ui/components/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/libs/ui/components/tooltip";
import {
  caseAdditionOf,
  caseMoveOf,
  caseRemovalOf,
  type CaseRow,
  casesOf,
  CONTINUE,
  type FieldWords,
  flowChoicesOf,
  otherwiseEditsOf,
  textEditsOf,
  thenEditsOf,
  whenPointerOf,
} from "../form-fields";
import { FieldShell, ProblemLines, useFieldProblems } from "./field-shell";
import { useFormSettings } from "./form-settings";
import type { ConditionSlot } from "./interfaces";
import { JsonControl } from "./value-controls";

interface SwitchCasesProps {
  readonly field: FormField;
  readonly words: FieldWords;
}

interface CaseCardProps {
  readonly holder: FormField;
  readonly row: CaseRow;
  readonly isFirst: boolean;
  readonly isLast: boolean;
}

export function SwitchCases({ field, words }: SwitchCasesProps) {
  const { onEdit, languageTerms } = useFormSettings();
  const problems = useFieldProblems(field, words);
  const rows = casesOf(field.value);
  const headingId = useId();

  if (rows === null)
    return (
      <FieldShell field={field} words={words} path="switch" labelsControl>
        {(wiring) => (
          <JsonControl field={field} words={words} wiring={wiring} />
        )}
      </FieldShell>
    );

  const branches = rows.filter((row) => !row.isOtherwise);
  const otherwise = rows.find((row) => row.isOtherwise) ?? null;
  const lastIndex = branches.length - 1;

  function add() {
    const edits = caseAdditionOf(field);
    onEdit(edits);
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3"
      onBlur={problems.leave}
    >
      <div className="flex flex-col gap-1">
        <h3 id={headingId} className="flex gap-2 font-semibold">
          {words.title}
          {languageTerms && (
            <code className="font-mono text-caption font-normal text-muted-foreground">
              switch
            </code>
          )}
        </h3>
        {words.help !== null && (
          <p className="text-caption text-muted-foreground">{words.help}</p>
        )}
        <ProblemLines problems={problems} />
      </div>
      {branches.map((row, index) => (
        <CaseCard
          key={row.name}
          holder={field}
          row={row}
          isFirst={index === 0}
          isLast={index === lastIndex}
        />
      ))}
      <OtherwiseCard holder={field} row={otherwise} />
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={add}
      >
        <PlusIcon data-icon="inline-start" />
        Add a branch
      </Button>
    </section>
  );
}

function CaseCard({ holder, row, isFirst, isLast }: CaseCardProps) {
  const { renderCondition, onEdit } = useFormSettings();
  const id = useId();
  const nameId = `${id}-name`;
  const pointer = whenPointerOf(holder.pointer, row);
  const text = row.when ?? "";
  const conditionLabel = `Condition of ${row.name}`;
  const slot: ConditionSlot = {
    pointer,
    text,
    required: true,
    labelledBy: nameId,
    describedBy: undefined,
    invalid: false,
  };
  const condition =
    renderCondition === undefined ? (
      <ExpressionInput pointer={pointer} text={text} label={conditionLabel} />
    ) : (
      renderCondition(slot)
    );

  function choose(then: string) {
    const edits = thenEditsOf(holder, row, then);

    onEdit(edits);
  }

  return (
    <div
      role="group"
      aria-labelledby={nameId}
      className="flex flex-col gap-3 rounded-lg border bg-surface p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 id={nameId} className="font-semibold">
          {row.name}
        </h4>
        <BranchActions
          holder={holder}
          row={row}
          isFirst={isFirst}
          isLast={isLast}
        />
      </div>
      {condition}
      <ThenSelect value={row.then} onChoose={choose} />
    </div>
  );
}

function OtherwiseCard({
  holder,
  row,
}: {
  readonly holder: FormField;
  readonly row: CaseRow | null;
}) {
  const { onEdit } = useFormSettings();
  const id = useId();
  const nameId = `${id}-name`;
  const then = row?.then ?? CONTINUE;

  function choose(chosen: string) {
    const edits = otherwiseEditsOf(holder, chosen);

    onEdit(edits);
  }

  return (
    <div
      role="group"
      aria-labelledby={nameId}
      className="flex flex-col gap-3 rounded-lg border bg-surface p-3"
    >
      <div className="flex items-baseline gap-2">
        <h4 id={nameId} className="font-semibold">
          Otherwise
        </h4>
        <span className="text-caption text-muted-foreground">
          when no other branch matches
        </span>
      </div>
      <ThenSelect value={then} onChoose={choose} />
    </div>
  );
}

function ThenSelect({
  value,
  onChoose,
}: {
  readonly value: string;
  readonly onChoose: (then: string) => void;
}) {
  const { flowChoices } = useFormSettings();
  const id = useId();
  const choices = flowChoicesOf(flowChoices);

  return (
    <Field>
      <FieldLabel htmlFor={id}>Then</FieldLabel>
      <Select value={value} onValueChange={onChoose}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function BranchActions({ holder, row, isFirst, isLast }: CaseCardProps) {
  const { onEdit } = useFormSettings();
  const label = `Branch actions for ${row.name}`;

  function move(by: -1 | 1) {
    const edits = caseMoveOf(holder, row, by);

    onEdit(edits);
  }

  function remove() {
    const edits = caseRemovalOf(holder, row);
    onEdit(edits);
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={label}
            >
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={isFirst}
          onSelect={() => {
            move(-1);
          }}
        >
          <ArrowUpIcon />
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isLast}
          onSelect={() => {
            move(1);
          }}
        >
          <ArrowDownIcon />
          Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={remove}>
          <Trash2Icon />
          Remove branch
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ExpressionInput({
  pointer,
  text,
  label,
}: {
  readonly pointer: string;
  readonly text: string;
  readonly label: string;
}) {
  const { onEdit } = useFormSettings();
  const condition = { pointer, required: true, written: true, value: text };

  return (
    <Input
      key={text}
      className="font-mono"
      aria-label={label}
      defaultValue={text}
      placeholder="${ .items | length > 0 }"
      onBlur={(event) => {
        const edits = textEditsOf(condition, event.currentTarget.value);

        onEdit(edits);
      }}
    />
  );
}
