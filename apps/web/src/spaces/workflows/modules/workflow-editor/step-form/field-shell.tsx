"use client";

import { PencilIcon } from "lucide-react";
import type { FormField } from "language-server/protocol";
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useId,
  useState,
} from "react";
import { diagnosticText } from "@/libs/language-client/diagnostic-text";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/libs/ui/components/field";
import type { FieldWords } from "../form-fields";
import { useFormSettings } from "./form-settings";

const NEEDS_VALUE = "This field needs a value.";

export interface ControlWiring {
  readonly id: string;
  readonly labelId: string;
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
  readonly onRefuse: (reason: string | null) => void;
}

export interface FieldProblems {
  readonly ids: {
    readonly control: string;
    readonly label: string;
    readonly help: string;
    readonly fill: string;
    readonly error: string;
  };
  readonly toFill: boolean;
  readonly message: string;
  readonly invalid: boolean;
  readonly describedBy: string | undefined;
  readonly leave: (event: FocusEvent<HTMLElement>) => void;
  readonly refuse: (reason: string | null) => void;
}

interface FieldShellProps {
  readonly field: FormField;
  readonly words: FieldWords;
  readonly path: string;
  readonly labelsControl: boolean;
  readonly children: (wiring: ControlWiring) => ReactNode;
}

export function useFieldProblems(
  field: FormField,
  words: FieldWords,
): FieldProblems {
  const settings = useFormSettings();
  const id = useId();
  const ids = {
    control: id,
    label: `${id}-label`,
    help: `${id}-help`,
    fill: `${id}-fill`,
    error: `${id}-error`,
  };
  const [left, setLeft] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const problems = field.diagnostics.map(diagnosticText);
  const isEmpty = isEmptyValue(field.value);
  const isToFill = field.required || words.fill !== null;
  const needsValue = isEmpty && isToFill;
  const missing = needsValue || (isEmpty && problems.length > 0);
  const waiting = !left && !settings.revealProblems;
  const toFill = missing && waiting;
  const told = toldOf(needsValue, words, problems);
  const reported = toFill ? [] : told;
  const errors = refusal === null ? reported : [refusal].concat(reported);
  const invalid = errors.length > 0;
  const describing = [
    words.help !== null ? ids.help : null,
    toFill ? ids.fill : null,
    invalid ? ids.error : null,
  ];
  const named = describing.filter((each) => each !== null);
  const describedBy = named.length > 0 ? named.join(" ") : undefined;
  const message = errors.join(" ");

  function leave(event: FocusEvent<HTMLElement>) {
    const target = event.relatedTarget;
    const staysInside = target !== null && event.currentTarget.contains(target);

    if (!staysInside) setLeft(true);
  }

  return {
    ids,
    toFill,
    message,
    invalid,
    describedBy,
    leave,
    refuse: setRefusal,
  };
}

export function blurOnEnter(event: KeyboardEvent<HTMLElement>) {
  if (event.key === "Enter") event.currentTarget.blur();
}

function toldOf(
  needsValue: boolean,
  words: FieldWords,
  problems: readonly string[],
): readonly string[] {
  if (needsValue && words.fill !== null) return [words.fill];

  if (problems.length > 0) return problems;

  if (needsValue) return [NEEDS_VALUE];

  return [];
}

export function FieldShell({
  field,
  words,
  path,
  labelsControl,
  children,
}: FieldShellProps) {
  const problems = useFieldProblems(field, words);
  const { ids } = problems;
  const htmlFor = labelsControl ? ids.control : undefined;
  const wiring = {
    id: ids.control,
    labelId: ids.label,
    describedBy: problems.describedBy,
    invalid: problems.invalid,
    onRefuse: problems.refuse,
  };
  const control = children(wiring);

  return (
    <Field data-invalid={problems.invalid} onBlur={problems.leave}>
      <FieldLabel id={ids.label} htmlFor={htmlFor}>
        <FieldTitle field={field} words={words} path={path} />
      </FieldLabel>
      {words.help !== null && (
        <FieldDescription id={ids.help}>{words.help}</FieldDescription>
      )}
      {control}
      <ProblemLines problems={problems} />
    </Field>
  );
}

export function ProblemLines({
  problems,
}: {
  readonly problems: FieldProblems;
}) {
  return (
    <>
      {problems.toFill && (
        <p
          id={problems.ids.fill}
          className="flex items-center gap-1 text-caption font-semibold text-warning-strong"
        >
          <PencilIcon className="size-3.5 text-warning" aria-hidden />
          Fill in
        </p>
      )}
      {problems.invalid && (
        <FieldError id={problems.ids.error}>{problems.message}</FieldError>
      )}
    </>
  );
}

export function FieldTitle({
  field,
  words,
  path,
}: {
  readonly field: FormField;
  readonly words: FieldWords;
  readonly path: string;
}) {
  const settings = useFormSettings();
  const term = path.replaceAll("/", ".");
  const isOptional = !field.required && words.fill === null;

  return (
    <>
      {words.title}
      {isOptional && (
        <span className="font-normal text-muted-foreground">optional</span>
      )}
      {settings.languageTerms && (
        <code className="font-mono text-caption font-normal text-muted-foreground">
          {term}
        </code>
      )}
    </>
  );
}

function isEmptyValue(value: FormField["value"]): boolean {
  if (value === null) return true;

  return typeof value === "string" && value.trim() === "";
}
