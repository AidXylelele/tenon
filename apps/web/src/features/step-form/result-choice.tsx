"use client";

import type {
  ChosenResult,
  EditAction,
  ResultReading,
} from "language-server/protocol";
import { useId } from "react";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/libs/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/libs/ui/components/select";
import { Switch } from "@/libs/ui/components/switch";
import { resultText } from "@/operations/form-fields";
import { useFormSettings } from "./form-settings";

interface ResultChoiceProps {
  readonly step: string;
  readonly result: ResultReading;
}

const KEEPING: ChosenResult = "inputAndValues";
const REPLACING: ChosenResult = "valuesOnly";

export function ResultChoice({ step, result }: ResultChoiceProps) {
  const keeps = result.choices.includes(KEEPING);

  if (keeps) return <KeepIncoming step={step} result={result} />;

  return <ResultSelect step={step} result={result} />;
}

function useResultSetter(step: string) {
  const { onEdit } = useFormSettings();

  return function set(chosen: ChosenResult, before: ResultReading["value"]) {
    if (chosen === before) return;

    const action: EditAction = { kind: "setResult", step, result: chosen };
    onEdit([action]);
  };
}

function KeepIncoming({ step, result }: ResultChoiceProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const set = useResultSetter(step);
  const checked = result.value === KEEPING;
  const isWritten = result.value === "written";
  const help = isWritten
    ? "The step's result is written as an expression under Data in and out; turn this on to keep the incoming data beside these values."
    : "Later steps get the incoming data plus these values. Turn off to pass on only these values.";

  return (
    <Field orientation="horizontal" className="items-start">
      <Switch
        id={id}
        checked={checked}
        aria-describedby={helpId}
        onCheckedChange={(next) => {
          const chosen = next ? KEEPING : REPLACING;
          set(chosen, result.value);
        }}
      />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={id}>Keep the data that came in</FieldLabel>
        <FieldDescription id={helpId}>{help}</FieldDescription>
      </div>
    </Field>
  );
}

function ResultSelect({ step, result }: ResultChoiceProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const set = useResultSetter(step);
  const isWritten = result.value === "written";
  const value = isWritten ? "" : result.value;

  return (
    <Field>
      <FieldLabel htmlFor={id}>The step&apos;s result</FieldLabel>
      <FieldDescription id={helpId}>
        The JSON it prints becomes data later steps can pick.
      </FieldDescription>
      <Select
        value={value}
        onValueChange={(chosen) => {
          const choice = result.choices.find((each) => each === chosen);

          if (choice !== undefined) set(choice, result.value);
        }}
      >
        <SelectTrigger id={id} className="w-full" aria-describedby={helpId}>
          <SelectValue placeholder="As written in the text" />
        </SelectTrigger>
        <SelectContent>
          {result.choices.map((choice) => (
            <SelectItem key={choice} value={choice}>
              {resultText(choice)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
