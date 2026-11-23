"use client";

import type {
  FormField,
  RetriedErrors,
  Step,
  StepFormResult,
} from "language-server/protocol";
import { useId, useState } from "react";
import { FieldError } from "@/libs/ui/components/field";
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
import { Disclosure } from "@/libs/ui/composites/disclosure";
import {
  BACKOFF_CHOICES,
  FAILURE_CHOICES,
  type FailureChoice,
  failureEditsOf,
  failureNoteOf,
  failureOf,
  type FailureReading,
  failureSummaryOf,
  FIRST_RETRY,
  RETRY_WHEN_CHOICES,
  retryChangeOf,
  retryCommitOf,
  type RetryCount,
  retryCountsOf,
  retryWhenCommitOf,
  statusesText,
} from "../form-fields";
import { blurOnEnter } from "./field-shell";
import { FieldView } from "./field-view";
import { useFormSettings } from "./form-settings";

interface FailureBoxProps {
  readonly step: Step;
  readonly form: StepFormResult;
  readonly protection: StepFormResult | null;
  readonly fields: readonly FormField[];
}

interface Refusal {
  readonly count: RetryCount;
  readonly reason: string;
}

const WRITTEN = "written";

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
    <Disclosure title="If this step fails" summary={summary} summaryBelow>
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
  const errorId = `${id}-error`;
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const shown = reading.retry ?? FIRST_RETRY;
  const counts = retryCountsOf(shown);
  const retriesRefused = refusal?.count === "retries";
  const secondsRefused = refusal?.count === "seconds";
  const retriesDescribedBy = retriesRefused ? errorId : undefined;
  const secondsDescribedBy = secondsRefused ? errorId : undefined;

  function changeCount(text: string, count: RetryCount) {
    const commit = retryCommitOf(reading, count, text);

    if (commit.kind === "refused") {
      setRefusal({ count, reason: commit.reason });
      return;
    }

    setRefusal(null);

    onEdit(commit.edits);
  }

  function chooseWait(chosen: string) {
    const picked = BACKOFF_CHOICES.find((each) => each.backoff === chosen);

    if (picked === undefined || picked.backoff === shown.backoff) return;

    const next = { ...shown, backoff: picked.backoff };
    const edits = retryChangeOf(reading, next);
    onEdit(edits);
  }

  return (
    <div
      role="group"
      aria-label="Retry settings"
      className="flex flex-col gap-3 pl-6"
    >
      {reading.isWrittenOtherwise && (
        <p className="text-caption text-muted-foreground">
          The wait between tries is written in another form in the text;
          changing it here writes it again.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={retriesId}>Try again</Label>
          <Input
            key={counts.retries}
            id={retriesId}
            inputMode="numeric"
            className="w-16"
            defaultValue={counts.retries}
            aria-describedby={retriesDescribedBy}
            aria-invalid={retriesRefused}
            onBlur={(event) => {
              changeCount(event.currentTarget.value, "retries");
            }}
            onKeyDown={blurOnEnter}
          />
          <span>times,</span>
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Input
              key={counts.seconds}
              id={secondsId}
              inputMode="numeric"
              className="w-16"
              aria-label="Seconds between tries"
              defaultValue={counts.seconds}
              aria-describedby={secondsDescribedBy}
              aria-invalid={secondsRefused}
              onBlur={(event) => {
                changeCount(event.currentTarget.value, "seconds");
              }}
              onKeyDown={blurOnEnter}
            />
            seconds apart
          </span>
        </div>
        {refusal !== null && (
          <FieldError id={errorId}>{refusal.reason}</FieldError>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={waitId}>The wait between tries</Label>
        <Select value={shown.backoff} onValueChange={chooseWait}>
          <SelectTrigger id={waitId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BACKOFF_CHOICES.map((each) => (
              <SelectItem key={each.backoff} value={each.backoff}>
                {each.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <RetryWhen key={JSON.stringify(shown.on)} reading={reading} />
    </div>
  );
}

function RetryWhen({ reading }: { readonly reading: FailureReading }) {
  const { onEdit } = useFormSettings();
  const id = useId();
  const whenId = `${id}-when`;
  const statusesId = `${id}-statuses`;
  const errorId = `${id}-error`;
  const on = (reading.retry ?? FIRST_RETRY).on;
  const written = statusesText(on);
  const [chosen, setChosen] = useState<string>(on.kind);
  const [refusal, setRefusal] = useState<string | null>(null);
  const invalid = refusal !== null;
  const describedBy = invalid ? errorId : undefined;
  const asksStatuses = chosen === "statuses";

  function commit(kind: RetriedErrors["kind"], statuses: string) {
    const change = retryWhenCommitOf(reading, kind, statuses);

    if (change.kind === "refused") {
      setRefusal(change.reason);
      return;
    }

    setRefusal(null);

    onEdit(change.edits);
  }

  function choose(next: string) {
    const picked = RETRY_WHEN_CHOICES.find((each) => each.on === next);
    setChosen(next);

    if (picked === undefined || picked.on === "statuses") return;

    commit(picked.on, "");
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={whenId}>Retry when</Label>
      <Select value={chosen} onValueChange={choose}>
        <SelectTrigger id={whenId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RETRY_WHEN_CHOICES.map((each) => (
            <SelectItem key={each.on} value={each.on}>
              {each.label}
            </SelectItem>
          ))}
          {on.kind === "written" && (
            <SelectItem value={WRITTEN}>As written in the text</SelectItem>
          )}
        </SelectContent>
      </Select>
      {asksStatuses && (
        <>
          <Label htmlFor={statusesId}>Statuses</Label>
          <Input
            key={written}
            id={statusesId}
            inputMode="numeric"
            className="placeholder:text-faint"
            placeholder="503, 429"
            defaultValue={written}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            onBlur={(event) => {
              commit("statuses", event.currentTarget.value);
            }}
            onKeyDown={blurOnEnter}
          />
          {invalid && <FieldError id={errorId}>{refusal}</FieldError>}
        </>
      )}
    </div>
  );
}
