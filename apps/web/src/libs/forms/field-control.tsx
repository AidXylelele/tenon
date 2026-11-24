"use client";

import type { EditAction, FormField } from "language-server/protocol";
import { useId, useState } from "react";
import { keysOf } from "@/libs/json/pointer";
import {
  diagnosticText,
  isSameDiagnostic,
} from "@/libs/language-client/diagnostic-text";
import {
  Field,
  FieldDescription,
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
import { Switch } from "@/libs/ui/components/switch";
import { Textarea } from "@/libs/ui/components/textarea";
import type { FieldProps, FieldValue } from "./interfaces";

const UNSET = "\u0000unset";
const OTHER = "";

const UNIT_MS: Readonly<Record<string, number>> = {
  days: 86_400_000,
  hours: 3_600_000,
  minutes: 60_000,
  seconds: 1000,
  milliseconds: 1,
};

export function FieldControl({ field, onEdit }: FieldProps) {
  if (field.input === "oneOf") {
    const written = field.fields.find((alternative) => alternative.written);
    return (
      <OneOfField key={written?.key ?? UNSET} field={field} onEdit={onEdit} />
    );
  }

  if (field.input === "duration")
    return (
      <DurationField
        key={JSON.stringify(field.value)}
        field={field}
        onEdit={onEdit}
      />
    );

  if (field.input === "group")
    return (
      <FieldSet className="gap-3 rounded-lg border p-3">
        <FieldLegend variant="label">
          <Titled field={field} />
        </FieldLegend>
        {field.description !== null && (
          <FieldDescription>{field.description}</FieldDescription>
        )}
        {field.fields.map((inner) => (
          <FieldControl key={inner.pointer} field={inner} onEdit={onEdit} />
        ))}
      </FieldSet>
    );

  return <ValueField field={field} onEdit={onEdit} />;
}

function OneOfField({ field, onEdit }: FieldProps) {
  const written = field.fields.find((alternative) => alternative.written);
  const first = written?.key ?? (field.written ? OTHER : UNSET);
  const [picked, setPicked] = useState(first);
  const alternative = field.fields.find((each) => each.key === picked) ?? null;
  const inner = alternative?.diagnostics ?? [];
  const own = field.diagnostics.filter(
    (diagnostic) => !inner.some((other) => isSameDiagnostic(diagnostic, other)),
  );
  const problems = own.map(diagnosticText);
  const invalid = problems.length > 0;

  function choose(key: string) {
    setPicked(key);

    if (key === UNSET && field.written)
      onEdit({ kind: "clearField", pointer: field.pointer });
  }

  function editPicked(action: EditAction) {
    if (alternative === null) return;

    const sent = alternativeEdit(field, alternative, action);

    if (sent !== null) onEdit(sent);
  }

  return (
    <FieldSet className="gap-3 rounded-lg border p-3">
      <FieldLegend variant="label">
        <Titled field={field} />
      </FieldLegend>
      {field.description !== null && (
        <FieldDescription>{field.description}</FieldDescription>
      )}
      <Field data-invalid={invalid}>
        <Select value={picked} onValueChange={choose}>
          <SelectTrigger aria-label={field.title} aria-invalid={invalid}>
            <SelectValue placeholder="Written in the text" />
          </SelectTrigger>
          <SelectContent>
            {!field.required && <SelectItem value={UNSET}>Not set</SelectItem>}
            {field.fields.map((each) => (
              <SelectItem key={each.key} value={each.key}>
                {each.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {invalid && <FieldError>{problems.join(" ")}</FieldError>}
      </Field>
      {alternative !== null && (
        <FieldControl field={alternative} onEdit={editPicked} />
      )}
    </FieldSet>
  );
}

function Titled({ field }: { readonly field: FieldProps["field"] }) {
  const title = field.required ? `${field.title} (required)` : field.title;

  return (
    <>
      {title}
      {field.title !== field.key && (
        <span
          aria-hidden
          className="font-mono text-xs font-normal text-muted-foreground"
        >
          {field.key}
        </span>
      )}
    </>
  );
}

function DurationField({ field, onEdit }: FieldProps) {
  const id = useId();
  const hint = `${id}-hint`;
  const total = totalOf(field);
  const fitting = field.fields.find(
    (unit) => total !== null && total % (UNIT_MS[unit.key] ?? 1) === 0,
  );
  const [unit, setUnit] = useState(fitting?.key ?? "minutes");
  const amount = total === null ? null : total / (UNIT_MS[unit] ?? 1);
  const [typed, setTyped] = useState(amount === null ? "" : String(amount));
  const problems = field.diagnostics.map(diagnosticText);
  const invalid = problems.length > 0;

  function commit(text: string, chosen: string) {
    if (text.trim() === "") {
      if (field.written) onEdit({ kind: "clearField", pointer: field.pointer });

      return;
    }

    const value = Number(text);

    if (Number.isNaN(value)) return;

    onEdit({
      kind: "setField",
      pointer: field.pointer,
      value: { [chosen]: value },
    });
  }

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>
        <Titled field={field} />
      </FieldLabel>
      <div className="flex gap-2">
        <Input
          id={id}
          type="number"
          min={0}
          value={typed}
          className="w-28"
          aria-describedby={hint}
          aria-invalid={invalid}
          onChange={(event) => {
            setTyped(event.currentTarget.value);
          }}
          onBlur={() => {
            commit(typed, unit);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <Select
          value={unit}
          onValueChange={(chosen) => {
            setUnit(chosen);
            commit(typed, chosen);
          }}
        >
          <SelectTrigger aria-label={`${field.title} unit`} className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.fields.map((each) => (
              <SelectItem key={each.key} value={each.key}>
                {each.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {field.description !== null && (
        <FieldDescription id={hint}>{field.description}</FieldDescription>
      )}
      {invalid && <FieldError>{problems.join(" ")}</FieldError>}
    </Field>
  );
}

function totalOf(field: FieldProps["field"]): number | null {
  const amounts = field.fields.flatMap((unit) =>
    typeof unit.value === "number"
      ? [unit.value * (UNIT_MS[unit.key] ?? 1)]
      : [],
  );

  if (amounts.length === 0) return null;

  return amounts.reduce((sum, each) => sum + each, 0);
}

function ValueField({ field, onEdit }: FieldProps) {
  const id = useId();
  const hint = `${id}-hint`;
  const problems = field.diagnostics.map(diagnosticText);
  const [refusal, setRefusal] = useState<string | null>(null);
  const shown = refusal === null ? problems : [refusal, ...problems];
  const invalid = shown.length > 0;

  function set(value: FieldValue) {
    setRefusal(null);
    onEdit({ kind: "setField", pointer: field.pointer, value });
  }

  function clear() {
    setRefusal(null);

    if (field.written) onEdit({ kind: "clearField", pointer: field.pointer });
  }

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>
        <Titled field={field} />
      </FieldLabel>
      <Control
        id={id}
        hint={hint}
        field={field}
        invalid={invalid}
        onSet={set}
        onClear={clear}
        onRefuse={setRefusal}
      />
      {field.description !== null && (
        <FieldDescription id={hint}>{field.description}</FieldDescription>
      )}
      {invalid && <FieldError>{shown.join(" ")}</FieldError>}
    </Field>
  );
}

function Control({
  id,
  hint,
  field,
  invalid,
  onSet,
  onClear,
  onRefuse,
}: {
  readonly id: string;
  readonly hint: string;
  readonly field: FieldProps["field"];
  readonly invalid: boolean;
  readonly onSet: (value: FieldValue) => void;
  readonly onClear: () => void;
  readonly onRefuse: (reason: string) => void;
}) {
  const written = JSON.stringify(field.value);

  switch (field.input) {
    case "boolean":
      return (
        <Switch
          id={id}
          checked={field.value === true}
          aria-describedby={hint}
          onCheckedChange={(checked) => {
            onSet(checked);
          }}
        />
      );
    case "choice": {
      const value = field.written ? written : UNSET;
      return (
        <Select
          value={value}
          onValueChange={(chosen) => {
            if (chosen === UNSET) {
              onClear();
              return;
            }

            const value: FieldValue = JSON.parse(chosen);
            onSet(value);
          }}
        >
          <SelectTrigger id={id} aria-describedby={hint} aria-invalid={invalid}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {!field.required && <SelectItem value={UNSET}>Not set</SelectItem>}
            {field.choices.map((choice) => {
              const key = JSON.stringify(choice);
              return (
                <SelectItem key={key} value={key}>
                  {textOf(choice)}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      );
    }
    case "number":
      return (
        <Input
          key={written}
          id={id}
          type="number"
          defaultValue={typeof field.value === "number" ? field.value : ""}
          aria-describedby={hint}
          aria-invalid={invalid}
          onBlur={(event) => {
            commitNumber(
              event.currentTarget.value,
              field.value,
              onSet,
              onClear,
            );
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      );
    case "structured":
      return (
        <Textarea
          key={written}
          id={id}
          rows={4}
          spellCheck={false}
          className="font-mono text-xs"
          defaultValue={
            field.written ? JSON.stringify(field.value, null, 2) : ""
          }
          aria-describedby={hint}
          aria-invalid={invalid}
          onBlur={(event) => {
            commitJson(
              event.currentTarget.value,
              field.value,
              onSet,
              onClear,
              onRefuse,
            );
          }}
        />
      );
    case "text":
    case "group": {
      const list = `${id}-choices`;
      const suggestions = field.choices.map(textOf);
      return (
        <>
          <Input
            key={written}
            id={id}
            list={suggestions.length > 0 ? list : undefined}
            defaultValue={typeof field.value === "string" ? field.value : ""}
            aria-describedby={hint}
            aria-invalid={invalid}
            onBlur={(event) => {
              commitText(
                event.currentTarget.value,
                field.value,
                onSet,
                onClear,
              );
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
          {suggestions.length > 0 && (
            <datalist id={list}>
              {suggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          )}
        </>
      );
    }
  }
}

function commitText(
  text: string,
  before: FieldValue,
  onSet: (value: FieldValue) => void,
  onClear: () => void,
): void {
  if (text === "") {
    onClear();
    return;
  }

  if (text !== before) onSet(text);
}

function commitNumber(
  text: string,
  before: FieldValue,
  onSet: (value: FieldValue) => void,
  onClear: () => void,
): void {
  if (text === "") {
    onClear();
    return;
  }

  const value = Number(text);

  if (value !== before) onSet(value);
}

function commitJson(
  text: string,
  before: FieldValue,
  onSet: (value: FieldValue) => void,
  onClear: () => void,
  onRefuse: (reason: string) => void,
): void {
  if (text.trim() === "") {
    onClear();
    return;
  }

  let value: FieldValue;

  try {
    value = JSON.parse(text);
  } catch {
    onRefuse("Write the value as JSON.");
    return;
  }

  const changed = JSON.stringify(value) !== JSON.stringify(before);

  if (changed) onSet(value);
}

function alternativeEdit(
  oneOf: FormField,
  alternative: FormField,
  action: EditAction,
): EditAction | null {
  if (action.kind === "clearField") {
    if (!alternative.written) return null;

    const members = alternative.fields.filter((member) => member.written);
    const last = members.length === 1 && members[0]?.pointer === action.pointer;
    const whole = action.pointer === alternative.pointer || last;

    if (!whole) return action;

    return { kind: "clearField", pointer: oneOf.pointer };
  }

  if (action.kind !== "setField" || alternative.written) return action;

  const below = action.pointer.slice(alternative.pointer.length);
  const path = keysOf(below);
  const inner = path.reduceRight<FieldValue>(
    (value, key) => ({ [key]: value }),
    action.value,
  );
  const value = { [alternative.key]: inner };
  return { kind: "setField", pointer: oneOf.pointer, value };
}

function textOf(value: FieldValue): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}
