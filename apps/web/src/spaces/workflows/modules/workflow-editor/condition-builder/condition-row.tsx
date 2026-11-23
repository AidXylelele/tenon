"use client";

import { XIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/libs/ui/components/button";
import { Field, FieldError, FieldLabel } from "@/libs/ui/components/field";
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
import { choiceOfValue, valueOf } from "../data-picker/data-choices";
import { blurOnEnter } from "../step-form";
import {
  COMPARISONS,
  type Draft,
  type DraftOperand,
  type DraftRow,
  rowProblemOf,
  secondOf,
  TIMES,
  withComparison,
  withLeft,
  withRight,
  withRowRemoved,
} from "./condition-rows";
import type { ConditionBuilderProps, PickedData } from "./interfaces";

interface RowProps extends Pick<
  ConditionBuilderProps,
  "data" | "samples" | "renderPicker"
> {
  readonly draft: Draft;
  readonly row: DraftRow;
  readonly position: number;
  readonly onDraft: (next: Draft) => void;
}

const TYPED = "value";
const DATA = "data";

const NO_SAMPLES: ReadonlyMap<string, never> = new Map<string, never>();

export function ConditionRowView({
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

  function setRight(right: DraftOperand, pick: PickedData | null) {
    const exported = pick === null ? null : exportOf(pick);
    const next = withRight(draft, row.id, right, exported);
    onDraft(next);
  }

  const leftPicker = renderPicker({ label: "Choose data", onPick: pickLeft });

  return (
    <li>
      <fieldset className="flex flex-col gap-3 rounded-md border p-3">
        <legend className="sr-only">{legend}</legend>
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
          <SecondValue
            row={row}
            offersOperand={second === "operand"}
            data={data}
            samples={samples}
            renderPicker={renderPicker}
            onRight={setRight}
          />
        )}
      </fieldset>
    </li>
  );
}

function exportOf(pick: PickedData) {
  return pick.export === null ? null : { step: pick.export, value: pick.value };
}

function DataName({
  path,
  data,
  samples,
}: {
  readonly path: string | null;
  readonly data: ConditionBuilderProps["data"];
  readonly samples: NonNullable<ConditionBuilderProps["samples"]>;
}) {
  if (path === null)
    return (
      <span className="text-caption text-muted-foreground">
        No data chosen yet
      </span>
    );

  const value = valueOf(path);
  const choice = data === null ? null : choiceOfValue(value, data, samples);

  if (choice === null)
    return <code className="font-mono text-code">{path}</code>;

  return (
    <span className="rounded-full border border-accent-border bg-accent-soft px-2.5 py-0.5 text-accent-text">
      {choice.label}
    </span>
  );
}

function SecondValue({
  row,
  offersOperand,
  data,
  samples,
  renderPicker,
  onRight,
}: Pick<ConditionBuilderProps, "data" | "renderPicker"> & {
  readonly row: DraftRow;
  readonly offersOperand: boolean;
  readonly samples: NonNullable<ConditionBuilderProps["samples"]>;
  readonly onRight: (right: DraftOperand, pick: PickedData | null) => void;
}) {
  const id = useId();
  const kindId = `${id}-kind`;

  function chooseKind(chosen: string) {
    const time = TIMES.find((each) => each.time === chosen);
    const right = time === undefined ? untimedOf(chosen) : timedOf(time.time);
    onRight(right, null);
  }

  function pickRight(pick: PickedData) {
    onRight({ kind: "data", path: pick.expression }, pick);
  }

  const shownKind = kindOf(row.right);
  const rightPicker = renderPicker({
    label: "Choose data to compare with",
    onPick: pickRight,
  });

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
        <TypedValue
          text={row.right.text}
          problem={rowProblemOf(row)}
          onText={(text) => {
            onRight({ kind: "value", text }, null);
          }}
        />
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
    ? { kind: "data", path: null }
    : { kind: "value", text: "" };
}

function timedOf(time: (typeof TIMES)[number]["time"]): DraftOperand {
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
