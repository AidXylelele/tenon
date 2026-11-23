"use client";

import type { FormField } from "language-server/protocol";
import { useRef, useState } from "react";
import { Input } from "@/libs/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/libs/ui/components/select";
import { Switch } from "@/libs/ui/components/switch";
import { Textarea } from "@/libs/ui/components/textarea";
import { cn } from "@/libs/ui/tokens/cn";
import {
  clearEditsOf,
  type Commit,
  type FieldWords,
  jsonCommitOf,
  jsonTextOf,
  numberCommitOf,
  textEditsOf,
  timeLimitCommitOf,
  timeLimitOf,
  valueEditsOf,
} from "../form-fields";
import { blurOnEnter, type ControlWiring } from "./field-shell";
import { useFormSettings } from "./form-settings";

export interface ControlProps {
  readonly field: FormField;
  readonly words: FieldWords;
  readonly wiring: ControlWiring;
}

const UNSET = "\u0000unset";

const FIRST_UNIT = "minutes";

const FAINT_HINT = "w-24 placeholder:text-faint";

const UNITS_MS: ReadonlyMap<string, number> = new Map([
  ["days", 86_400_000],
  ["hours", 3_600_000],
  ["minutes", 60_000],
  ["seconds", 1000],
  ["milliseconds", 1],
]);

export function TextControl({
  field,
  words,
  wiring,
  multiline = false,
}: ControlProps & { readonly multiline?: boolean }) {
  const { onEdit } = useFormSettings();
  const written = typeof field.value === "string" ? field.value : "";
  const isExpression = written.startsWith("${");
  const mono = words.mono || isExpression || multiline;
  const className = cn("placeholder:text-faint", mono && "font-mono");
  const suggestions = field.choices.filter(
    (choice) => typeof choice === "string",
  );
  const listId = `${wiring.id}-choices`;
  const list = suggestions.length > 0 ? listId : undefined;

  function commit(text: string) {
    const edits = textEditsOf(field, text);

    onEdit(edits);
  }

  if (multiline)
    return (
      <Textarea
        key={written}
        id={wiring.id}
        rows={6}
        spellCheck={false}
        className={className}
        defaultValue={written}
        aria-labelledby={wiring.labelId}
        aria-describedby={wiring.describedBy}
        aria-invalid={wiring.invalid}
        onBlur={(event) => {
          commit(event.currentTarget.value);
        }}
      />
    );

  return (
    <>
      <Input
        key={written}
        id={wiring.id}
        list={list}
        className={className}
        placeholder={words.placeholder}
        defaultValue={written}
        aria-labelledby={wiring.labelId}
        aria-describedby={wiring.describedBy}
        aria-invalid={wiring.invalid}
        onBlur={(event) => {
          commit(event.currentTarget.value);
        }}
        onKeyDown={blurOnEnter}
      />
      {list !== undefined && (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
    </>
  );
}

function useCommit(wiring: ControlWiring) {
  const { onEdit } = useFormSettings();

  return function apply(commit: Commit) {
    if (commit.kind === "refused") {
      wiring.onRefuse(commit.reason);
      return;
    }

    wiring.onRefuse(null);

    onEdit(commit.edits);
  };
}

export function NumberControl({ field, wiring }: ControlProps) {
  const apply = useCommit(wiring);
  const written = typeof field.value === "number" ? String(field.value) : "";

  return (
    <Input
      key={written}
      id={wiring.id}
      inputMode="decimal"
      className="w-32"
      defaultValue={written}
      aria-describedby={wiring.describedBy}
      aria-invalid={wiring.invalid}
      onBlur={(event) => {
        const commit = numberCommitOf(field, event.currentTarget.value);
        apply(commit);
      }}
      onKeyDown={blurOnEnter}
    />
  );
}

export function BooleanControl({ field, wiring }: ControlProps) {
  const { onEdit } = useFormSettings();
  const checked = field.value === true;

  return (
    <Switch
      id={wiring.id}
      checked={checked}
      aria-describedby={wiring.describedBy}
      aria-invalid={wiring.invalid}
      onCheckedChange={(next) => {
        const edits = valueEditsOf(field, next);
        onEdit(edits);
      }}
    />
  );
}

export function ChoiceControl({ field, words, wiring }: ControlProps) {
  const { onEdit } = useFormSettings();
  const value = field.written ? JSON.stringify(field.value) : UNSET;

  function choose(chosen: string) {
    const choice = field.choices.find(
      (each) => JSON.stringify(each) === chosen,
    );
    const edits =
      choice === undefined ? clearEditsOf(field) : valueEditsOf(field, choice);

    onEdit(edits);
  }

  return (
    <Select value={value} onValueChange={choose}>
      <SelectTrigger
        id={wiring.id}
        className="w-full"
        aria-describedby={wiring.describedBy}
        aria-invalid={wiring.invalid}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {!field.required && <SelectItem value={UNSET}>Usual</SelectItem>}
        {field.choices.map((choice) => {
          const key = JSON.stringify(choice);
          const plain = typeof choice === "string" ? choice : key;
          const text = words.choices.get(plain) ?? plain;
          return (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export function JsonControl({ field, wiring }: ControlProps) {
  const apply = useCommit(wiring);
  const written = jsonTextOf(field.value);

  return (
    <Textarea
      key={written}
      id={wiring.id}
      rows={4}
      spellCheck={false}
      className="font-mono text-code"
      defaultValue={written}
      aria-describedby={wiring.describedBy}
      aria-invalid={wiring.invalid}
      onBlur={(event) => {
        const commit = jsonCommitOf(field, event.currentTarget.value);
        apply(commit);
      }}
    />
  );
}

export function TimeLimitControl(props: ControlProps) {
  const { field, words, wiring } = props;
  const apply = useCommit(wiring);
  const seconds = timeLimitOf(field.value);
  const shown = seconds === null ? "" : String(seconds);
  const isOtherwise = field.written && seconds === null;

  if (isOtherwise && typeof field.value === "string")
    return <TextControl {...props} />;

  if (isOtherwise) return <JsonControl {...props} />;

  function commit(text: string) {
    if (text.trim() === shown) return;

    const limit = timeLimitCommitOf(field, text);
    apply(limit);
  }

  return (
    <Input
      key={shown}
      id={wiring.id}
      inputMode="numeric"
      className={FAINT_HINT}
      placeholder={words.placeholder}
      defaultValue={shown}
      aria-describedby={wiring.describedBy}
      aria-invalid={wiring.invalid}
      onBlur={(event) => {
        commit(event.currentTarget.value);
      }}
      onKeyDown={blurOnEnter}
    />
  );
}

export function DurationControl(props: ControlProps) {
  const shown = JSON.stringify(props.field.value);

  return <DurationAmount key={shown} {...props} />;
}

function DurationAmount({ field, wiring }: ControlProps) {
  const apply = useCommit(wiring);
  const typed = useRef<HTMLInputElement>(null);
  const total = totalOf(field);
  const fitting = field.fields.find((unit) => {
    const scale = UNITS_MS.get(unit.key) ?? 1;
    return total !== null && total % scale === 0;
  });
  const shownUnit = fitting?.key ?? FIRST_UNIT;
  const [unit, setUnit] = useState(shownUnit);
  const scale = UNITS_MS.get(shownUnit) ?? 1;
  const amount = total === null ? "" : String(total / scale);
  const unitLabel = `${wiring.id}-unit`;
  const unitLabelledBy = `${wiring.labelId} ${unitLabel}`;

  function commit(text: string, chosen: string) {
    const trimmed = text.trim();
    const isShown = trimmed === amount && chosen === shownUnit;

    if (isShown) return;

    if (trimmed === "") {
      const edits = clearEditsOf(field);
      apply({ kind: "edits", edits });
      return;
    }

    const value = Number(trimmed);

    if (!Number.isFinite(value)) {
      apply({ kind: "refused", reason: "Write the amount as a number." });
      return;
    }

    const units = { [chosen]: value };
    const edits = valueEditsOf(field, units);
    apply({ kind: "edits", edits });
  }

  return (
    <div className="flex gap-2">
      <Input
        ref={typed}
        id={wiring.id}
        inputMode="decimal"
        className="w-28"
        defaultValue={amount}
        aria-describedby={wiring.describedBy}
        aria-invalid={wiring.invalid}
        onBlur={(event) => {
          commit(event.currentTarget.value, unit);
        }}
        onKeyDown={blurOnEnter}
      />
      <Select
        value={unit}
        onValueChange={(chosen) => {
          const text = typed.current?.value ?? amount;
          setUnit(chosen);
          commit(text, chosen);
        }}
      >
        <SelectTrigger aria-labelledby={unitLabelledBy} className="w-36">
          <span id={unitLabel} className="sr-only">
            unit
          </span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.fields.map((each) => (
            <SelectItem key={each.key} value={each.key}>
              {each.title.toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function totalOf(field: FormField): number | null {
  const amounts = field.fields.flatMap((unit) => {
    const scale = UNITS_MS.get(unit.key) ?? 1;
    return typeof unit.value === "number" ? [unit.value * scale] : [];
  });

  if (amounts.length === 0) return null;

  return amounts.reduce((sum, each) => sum + each, 0);
}
