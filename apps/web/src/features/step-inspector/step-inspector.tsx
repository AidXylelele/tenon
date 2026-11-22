"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import type { Failure, FailureKind, FormField } from "language-server/protocol";
import { useId } from "react";
import { FieldControl } from "@/libs/forms/field-control";
import { FormSections, fieldsIn } from "@/libs/forms/form-sections";
import { Button } from "@/libs/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/libs/ui/components/field";
import { Input } from "@/libs/ui/components/input";
import { Label } from "@/libs/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@/libs/ui/components/radio-group";
import { kindInfoOf } from "@/operations/step-kinds";
import type { StepInspectorProps } from "./interfaces";

const FAILURES: readonly {
  readonly kind: FailureKind;
  readonly label: string;
}[] = [
  { kind: "stop", label: "Stop the run" },
  { kind: "continue", label: "Go on with the next task" },
  { kind: "retry", label: "Retry" },
  { kind: "handle", label: "Run other tasks instead" },
];

const FIRST_RETRY: Failure = {
  kind: "retry",
  retries: 3,
  seconds: 5,
  growing: false,
};

export function StepInspector({
  step,
  form,
  formless,
  place,
  onEdit,
  onClose,
}: StepInspectorProps) {
  const kind = kindInfoOf(step.kind);
  const nameId = useId();
  const first = place === null || place.index === 0;
  const last = place === null || place.index === place.size - 1;

  function move(by: number) {
    if (place === null) return;

    const index = place.index + by;
    onEdit({ kind: "moveStep", step: step.id, list: place.list, index });
  }

  return (
    <section
      aria-label={`Task ${step.name}`}
      className="flex min-h-0 flex-1 flex-col"
    >
      <header className="flex items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="heading-3 truncate">{step.name}</h2>
          <p className="text-xs text-muted-foreground">{kind.label}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close the task"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </header>
      <div className="flex flex-wrap gap-1 border-b px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={first}
          onClick={() => {
            move(-1);
          }}
        >
          <ArrowUpIcon data-icon="inline-start" />
          Up
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={last}
          onClick={() => {
            move(1);
          }}
        >
          <ArrowDownIcon data-icon="inline-start" />
          Down
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onEdit({ kind: "duplicateStep", step: step.id });
          }}
        >
          <CopyIcon data-icon="inline-start" />
          Duplicate
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onEdit({ kind: "removeStep", step: step.id });
          }}
        >
          <Trash2Icon data-icon="inline-start" />
          Delete
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
        <Field>
          <FieldLabel htmlFor={nameId}>Name</FieldLabel>
          <Input
            key={step.name}
            id={nameId}
            defaultValue={step.name}
            onBlur={(event) => {
              const name = event.currentTarget.value.trim();

              if (name !== "" && name !== step.name)
                onEdit({ kind: "renameStep", step: step.id, name });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
          <FieldDescription>{kind.description}</FieldDescription>
        </Field>
        {formless && (
          <p className="text-sm text-muted-foreground" role="status">
            The text has a problem the language service cannot read past. Fix it
            to change this task here.
          </p>
        )}
        {form !== null && (
          <>
            <Failures
              failure={form.failure}
              fields={fieldsIn(form.fields, "failure")}
              onChoose={(failure) => {
                onEdit({ kind: "setFailure", step: step.id, failure });
              }}
              onEdit={onEdit}
            />
            <FormSections fields={form.fields} onEdit={onEdit} />
          </>
        )}
      </div>
    </section>
  );
}

function Failures({
  failure,
  fields,
  onChoose,
  onEdit,
}: {
  readonly failure: FailureKind;
  readonly fields: readonly FormField[];
  readonly onChoose: (failure: Failure) => void;
  readonly onEdit: StepInspectorProps["onEdit"];
}) {
  const id = useId();

  return (
    <FieldSet className="gap-4">
      <FieldLegend>If it fails</FieldLegend>
      <RadioGroup
        value={failure}
        onValueChange={(chosen) => {
          const next = failureOf(chosen);

          if (next !== null) onChoose(next);
        }}
      >
        {FAILURES.map((each) => {
          const itemId = `${id}-${each.kind}`;
          return (
            <div key={each.kind} className="flex items-center gap-2">
              <RadioGroupItem id={itemId} value={each.kind} />
              <Label htmlFor={itemId}>{each.label}</Label>
            </div>
          );
        })}
      </RadioGroup>
      {fields.map((field) => (
        <FieldControl key={field.pointer} field={field} onEdit={onEdit} />
      ))}
    </FieldSet>
  );
}

function failureOf(kind: string): Failure | null {
  switch (kind) {
    case "stop":
    case "continue":
    case "handle":
      return { kind };
    case "retry":
      return FIRST_RETRY;
    default:
      return null;
  }
}
