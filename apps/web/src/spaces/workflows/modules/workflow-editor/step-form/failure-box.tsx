"use client";

import type { FormField, Step, StepFormResult } from "language-server/protocol";
import { type KeyboardEvent, useId } from "react";
import { Input } from "@/libs/ui/components/input";
import { Label } from "@/libs/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@/libs/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/libs/ui/components/select";
import {
  FAILURE_CHOICES,
  type FailureChoice,
  failureEditsOf,
  failureNoteOf,
  failureOf,
  type FailureReading,
  failureSummaryOf,
  FIRST_RETRY,
  retryChangeOf,
  type RetrySettings,
} from "../form-fields";
import { Disclosure } from "./disclosure";
import { FieldView } from "./field-view";
import { useFormSettings } from "./form-settings";

interface FailureBoxProps {
  readonly step: Step;
  readonly form: StepFormResult;
  readonly protection: StepFormResult | null;
  readonly fields: readonly FormField[];
}

const GROWING = "growing";
const STEADY = "steady";

const RETRYING: ReadonlySet<FailureChoice> = new Set([
  "retryThenStop",
  "retryThenHandle",
]);

export function FailureBox({
  step,
  form,
  protection,
  fields,
}: FailureBoxProps) {
  const { onEdit } = useFormSettings();
  const id = useId();
  const reading = failureOf(step, form, protection);
  const summary = failureSummaryOf(reading);
  const note = failureNoteOf(reading.choice);
  const isRetrying = RETRYING.has(reading.choice);

  function choose(chosen: string) {
    const choice = FAILURE_CHOICES.find((each) => each.choice === chosen);

    if (choice === undefined) return;

    const retry = reading.retry ?? FIRST_RETRY;
    const edits = failureEditsOf(reading, choice.choice, retry);

    onEdit(edits);
  }

  return (
    <Disclosure title="If this step fails" summary={summary}>
      <RadioGroup
        value={reading.choice}
        onValueChange={choose}
        aria-label="If this step fails"
      >
        {FAILURE_CHOICES.map((each) => {
          const itemId = `${id}-${each.choice}`;
          return (
            <div key={each.choice} className="flex items-center gap-2">
              <RadioGroupItem id={itemId} value={each.choice} />
              <Label htmlFor={itemId} className="font-normal">
                {each.label}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
      {isRetrying && <RetrySettingsView reading={reading} />}
      {note !== null && (
        <p className="text-caption text-muted-foreground">{note}</p>
      )}
      {fields.map((field) => (
        <FieldView key={field.pointer} field={field} />
      ))}
    </Disclosure>
  );
}

function RetrySettingsView({ reading }: { readonly reading: FailureReading }) {
  const { onEdit } = useFormSettings();
  const id = useId();
  const retriesId = `${id}-retries`;
  const secondsId = `${id}-seconds`;
  const waitId = `${id}-wait`;
  const shown = reading.retry ?? FIRST_RETRY;
  const retries = String(shown.retries);
  const seconds = String(shown.seconds);
  const wait = shown.growing ? GROWING : STEADY;

  function change(next: RetrySettings) {
    const edits = retryChangeOf(reading, next);

    onEdit(edits);
  }

  function changeCount(text: string, key: "retries" | "seconds") {
    const amount = Number(text);
    const isAmount =
      Number.isFinite(amount) && amount >= 0 && text.trim() !== "";

    if (!isAmount || amount === shown[key]) return;

    const next = { ...shown, [key]: amount };
    change(next);
  }

  function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
  }

  return (
    <div
      role="group"
      aria-label="Retry settings"
      className="flex flex-col gap-3 pl-6"
    >
      {reading.retry === null && (
        <p className="text-caption text-muted-foreground">
          The retry is written in another form in the text; changing it here
          writes it again.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={retriesId}>Try again</Label>
        <Input
          key={retries}
          id={retriesId}
          inputMode="numeric"
          className="w-16"
          defaultValue={retries}
          onBlur={(event) => {
            changeCount(event.currentTarget.value, "retries");
          }}
          onKeyDown={blurOnEnter}
        />
        <span>times,</span>
        <Input
          key={seconds}
          id={secondsId}
          inputMode="decimal"
          className="w-16"
          aria-label="Seconds between tries"
          defaultValue={seconds}
          onBlur={(event) => {
            changeCount(event.currentTarget.value, "seconds");
          }}
          onKeyDown={blurOnEnter}
        />
        <span>seconds apart</span>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={waitId}>The wait between tries</Label>
        <Select
          value={wait}
          onValueChange={(chosen) => {
            const growing = chosen === GROWING;
            const next = { ...shown, growing };
            change(next);
          }}
        >
          <SelectTrigger id={waitId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GROWING}>grows: doubling each time</SelectItem>
            <SelectItem value={STEADY}>stays the same</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
