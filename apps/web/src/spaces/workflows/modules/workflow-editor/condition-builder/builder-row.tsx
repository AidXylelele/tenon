"use client";

import { XIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/libs/ui/components/button";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/libs/ui/components/field";
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
import { choiceOfExpression, NO_SAMPLES } from "../data-picker";
import { blurOnEnter } from "../step-form";
import {
  COMPARISONS,
  type DataExport,
  type Draft,
  type DraftOperand,
  type DraftRow,
  rowProblemOf,
  secondOf,
  TIMES,
  type TimeName,
  withComparison,
  withLeft,
  withRight,
  withRowRemoved,
} from "./condition-rows";
import type {
  ConditionBuilderProps,
  PickedData,
  PickerSlot,
} from "./interfaces";

type Offered = Pick<ConditionBuilderProps, "data" | "renderPicker">;

type Samples = NonNullable<ConditionBuilderProps["samples"]>;

interface RowProps extends Offered {
  readonly draft: Draft;
  readonly row: DraftRow;
  readonly position: number;
  readonly samples?: Samples;
  readonly onDraft: (next: Draft) => void;
}

const TYPED = "value";
const DATA = "data";

export function BuilderRow({
  draft,
  row,
  position,
  data,
  samples = NO_SAMPLES,
  renderPicker,
  onDraft,
}: RowProps) {
  const id = useId();
  const valueId = `${id}-value`;
  const comparisonId = `${id}-comparison`;
  const legend = `Condition ${String(position)}`;
  const removal = `Remove condition ${String(position)}`;
  const second = secondOf(row.comparison);
  const offersOperand = second === "operand";

  function pickLeft(pick: PickedData) {
    const exported = exportOf(pick);
    const next = withLeft(draft, row.id, pick.expression, exported);
    onDraft(next);
  }

  function compare(chosen: string) {
    const picked = COMPARISONS.find((each) => each.comparison === chosen);

    if (picked === undefined) return;

    const next = withComparison(draft, row.id, picked.comparison);
    onDraft(next);
  }

  function remove() {
    const next = withRowRemoved(draft, row.id);
    onDraft(next);
  }

  function setRight(right: DraftOperand) {
    const next = withRight(draft, row.id, right);
    onDraft(next);
  }

  const leftSlot: PickerSlot = { label: "Choose data", onPick: pickLeft };
  const leftPicker = renderPicker(leftSlot);

  return (
    <li>
      <FieldSet className="gap-3 rounded-md border p-3">
        <FieldLegend className="sr-only">{legend}</FieldLegend>
        <Field>
          <FieldLabel id={valueId}>Value</FieldLabel>
          <div
            role="group"
            aria-labelledby={valueId}
            className="flex flex-wrap items-center gap-2"
          >
            <DataName path={row.left} data={data} samples={samples} />
            {leftPicker}
          </div>
        </Field>
        <div className="flex items-end gap-2">
          <Field className="min-w-0 flex-1">
            <FieldLabel htmlFor={comparisonId}>Comparison</FieldLabel>
            <Select value={row.comparison} onValueChange={compare}>
              <SelectTrigger id={comparisonId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPARISONS.map((each) => (
                  <SelectItem key={each.comparison} value={each.comparison}>
                    {each.words}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={removal}
                onClick={remove}
              >
                <XIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{removal}</TooltipContent>
          </Tooltip>
        </div>
        {second !== "none" && (
          <ComparedWith
            row={row}
            offersOperand={offersOperand}
            data={data}
            samples={samples}
            renderPicker={renderPicker}
            onRight={setRight}
          />
        )}
      </FieldSet>
    </li>
  );
}

function exportOf(pick: PickedData): DataExport | null {
  if (pick.export === null) return null;

  return { step: pick.export, value: pick.value };
}

function DataName({
  path,
  data,
  samples,
}: {
  readonly path: string | null;
  readonly data: ConditionBuilderProps["data"];
  readonly samples: Samples;
}) {
  if (path === null)
    return (
      <span className="text-caption text-muted-foreground">
        No data chosen yet
      </span>
    );

  const choice = data === null ? null : choiceOfExpression(path, data, samples);

  if (choice === null)
    return <code className="font-mono text-code">{path}</code>;

  return (
    <span className="rounded-full border border-accent-border bg-accent-soft px-2.5 py-0.5 text-accent-text">
      {choice.label}
    </span>
  );
}

function ComparedWith({
  row,
  offersOperand,
  data,
  samples,
  renderPicker,
  onRight,
}: Offered & {
  readonly row: DraftRow;
  readonly offersOperand: boolean;
  readonly samples: Samples;
  readonly onRight: (right: DraftOperand) => void;
}) {
  const id = useId();
  const kindId = `${id}-kind`;
  const shownKind = kindOf(row.right);
  const problem = rowProblemOf(row);

  function chooseKind(chosen: string) {
    const time = TIMES.find((each) => each.time === chosen);
    const right = time === undefined ? untimedOf(chosen) : timedOf(time.time);
    onRight(right);
  }

  function pickRight(pick: PickedData) {
    const exported = exportOf(pick);
    const right: DraftOperand = {
      kind: "data",
      path: pick.expression,
      export: exported,
    };
    onRight(right);
  }

  function type(text: string) {
    const right: DraftOperand = { kind: "value", text };
    onRight(right);
  }

  const rightSlot: PickerSlot = {
    label: "Choose data to compare with",
    onPick: pickRight,
  };
  const rightPicker = renderPicker(rightSlot);

  return (
    <>
      {offersOperand && (
        <Field>
          <FieldLabel htmlFor={kindId}>Compared with</FieldLabel>
          <Select value={shownKind} onValueChange={chooseKind}>
            <SelectTrigger id={kindId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TYPED}>A value you type</SelectItem>
              <SelectItem value={DATA}>Data from the workflow</SelectItem>
              {TIMES.map((each) => (
                <SelectItem key={each.time} value={each.time}>
                  {each.words}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {row.right.kind === "value" && (
        <TypedValue text={row.right.text} problem={problem} onText={type} />
      )}
      {row.right.kind === "data" && (
        <div className="flex flex-wrap items-center gap-2">
          <DataName path={row.right.path} data={data} samples={samples} />
          {rightPicker}
        </div>
      )}
    </>
  );
}

function kindOf(right: DraftOperand): string {
  switch (right.kind) {
    case "time":
      return right.time;
    case "data":
      return DATA;
    case "value":
    case "none":
      return TYPED;
  }
}

function untimedOf(chosen: string): DraftOperand {
  return chosen === DATA
    ? { kind: "data", path: null, export: null }
    : { kind: "value", text: "" };
}

function timedOf(time: TimeName): DraftOperand {
  return { kind: "time", time };
}

function TypedValue({
  text,
  problem,
  onText,
}: {
  readonly text: string;
  readonly problem: string | null;
  readonly onText: (text: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const invalid = problem !== null;
  const describedBy = invalid ? errorId : undefined;

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>Value to compare with</FieldLabel>
      <Input
        key={text}
        id={id}
        defaultValue={text}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        onBlur={(event) => {
          const typed = event.currentTarget.value;

          if (typed !== text) onText(typed);
        }}
        onKeyDown={blurOnEnter}
      />
      {invalid && <FieldError id={errorId}>{problem}</FieldError>}
    </Field>
  );
}
