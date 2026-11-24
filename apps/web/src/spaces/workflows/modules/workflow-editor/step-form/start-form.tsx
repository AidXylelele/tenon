"use client";

import type { FormField } from "language-server/protocol";
import { useId } from "react";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/libs/ui/components/field";
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
import { Link } from "@/libs/routing/link";
import { WEBHOOKS_HREF } from "@/libs/routing/routes";
import { Disclosure } from "@/libs/ui/composites/disclosure";
import { FIRST_CRON } from "@/operations/schedule-words";
import {
  type FieldWords,
  eventEditsOf,
  startEditsOf,
  type StartReading,
  type StartWay,
  startOf,
  summaryOf,
} from "../form-fields";
import { ProblemLines, useFieldProblems } from "./field-shell";
import { FieldView } from "./field-view";
import {
  type FormSettings,
  FormSettingsContext,
  skippingEmpty,
  useFormSettings,
} from "./form-settings";
import type { StartFormProps, Webhook } from "./interfaces";
import { ScheduleBuilder } from "./schedule-builder";

const WAYS: readonly {
  readonly way: StartWay;
  readonly title: string;
  readonly description: string;
}[] = [
  {
    way: "hand",
    title: "By hand",
    description: "or when another app starts it",
  },
  {
    way: "schedule",
    title: "On a schedule",
    description: "every day, hour or week",
  },
  {
    way: "webhook",
    title: "When a webhook is called",
    description: "another app calls its address",
  },
  {
    way: "event",
    title: "When an event arrives",
    description: "an event of a type you choose",
  },
];

const NO_WEBHOOK = "No webhook yet: add one under Connections, Webhooks.";

const NO_FLOW: readonly FormField["value"][] = [];

const EVENT_WORDS: FieldWords = {
  title: "Event type",
  help: null,
  placeholder: "com.example.order.placed.v1",
  fill: "Enter the type of event that starts the workflow.",
  control: "value",
  mono: true,
  choices: new Map(),
};

export function StartForm({
  form,
  webhooks,
  now,
  zone,
  revealProblems,
  languageTerms,
  onEdit,
}: StartFormProps) {
  const id = useId();
  const send = skippingEmpty(onEdit);
  const legendId = `${id}-legend`;
  const schedule = form.fields.find((field) => field.pointer === "/schedule");
  const input = form.fields.find((field) => field.pointer === "/input");
  const webhookTypes = webhooks.map((webhook) => webhook.eventType);
  const start = startOf(schedule, webhookTypes);
  const firstWebhook = webhookTypes[0] ?? null;
  const inputFields = input?.fields ?? [];
  const inputSummary = summaryOf(inputFields, "start", "", "Any JSON");
  const settings: FormSettings = {
    kind: "start",
    base: "",
    revealProblems,
    languageTerms,
    fields: form.fields,
    flowChoices: NO_FLOW,
    scriptLanguage: "",
    timeLimit: null,
    onEdit: send,
  };

  function choose(chosen: string) {
    const way = WAYS.find((each) => each.way === chosen)?.way;

    if (schedule === undefined || way === undefined) return;

    const begin = { cron: FIRST_CRON, eventType: firstWebhook };
    const edits = startEditsOf(schedule, start, way, begin);

    send(edits);
  }

  return (
    <FormSettingsContext value={settings}>
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend id={legendId} className="mb-2 font-semibold">
            How it starts
          </legend>
          <RadioGroup
            value={start.way}
            onValueChange={choose}
            aria-labelledby={legendId}
            className="gap-3"
          >
            {WAYS.map((each) => {
              const itemId = `${id}-${each.way}`;
              const noWebhook = each.way === "webhook" && webhooks.length === 0;
              const description = noWebhook ? NO_WEBHOOK : each.description;
              const descriptionId = `${itemId}-description`;
              return (
                <div key={each.way} className="flex items-start gap-2">
                  <RadioGroupItem
                    id={itemId}
                    value={each.way}
                    disabled={noWebhook}
                    aria-describedby={descriptionId}
                    className="mt-0.5"
                  />
                  <div className="flex flex-col">
                    <Label htmlFor={itemId} className="font-normal">
                      {each.title}
                    </Label>
                    <span
                      id={descriptionId}
                      className="text-caption text-muted-foreground"
                    >
                      {description}
                    </span>
                  </div>
                </div>
              );
            })}
          </RadioGroup>
        </fieldset>
        {schedule !== undefined && (
          <WayDetails
            schedule={schedule}
            start={start}
            webhooks={webhooks}
            now={now}
            zone={zone}
          />
        )}
        {input !== undefined && (
          <Disclosure
            title="Workflow input"
            summary={inputSummary}
            summaryBelow
          >
            {inputFields.map((field) => (
              <FieldView key={field.pointer} field={field} />
            ))}
          </Disclosure>
        )}
      </div>
    </FormSettingsContext>
  );
}

function WayDetails({
  schedule,
  start,
  webhooks,
  now,
  zone,
}: {
  readonly schedule: FormField;
  readonly start: StartReading;
  readonly webhooks: readonly Webhook[];
  readonly now: string;
  readonly zone: string;
}) {
  switch (start.way) {
    case "hand":
      return null;
    case "schedule":
      return start.timed === null ? (
        <ScheduleBuilder
          key={start.cron}
          schedule={schedule}
          cron={start.cron ?? ""}
          now={now}
          zone={zone}
        />
      ) : (
        <FieldView field={start.timed} />
      );
    case "webhook":
      return (
        <WebhookChoice
          schedule={schedule}
          webhooks={webhooks}
          eventType={start.eventType}
        />
      );
    case "event":
      return <EventTypeField schedule={schedule} eventType={start.eventType} />;
  }
}

function WebhookChoice({
  schedule,
  webhooks,
  eventType,
}: {
  readonly schedule: FormField;
  readonly webhooks: readonly Webhook[];
  readonly eventType: string | null;
}) {
  const settings = useFormSettings();
  const id = useId();
  const helpId = `${id}-help`;
  const chosen = webhooks.find((webhook) => webhook.eventType === eventType);
  const value = chosen?.eventType ?? "";

  function choose(type: string) {
    const edits = eventEditsOf(schedule, type);
    settings.onEdit(edits);
  }

  return (
    <>
      <Field>
        <FieldLabel htmlFor={id}>Webhook</FieldLabel>
        <FieldDescription id={helpId}>
          Another app calls its address; each call starts a run with the
          call&apos;s data.
        </FieldDescription>
        <Select value={value} onValueChange={choose}>
          <SelectTrigger id={id} className="w-full" aria-describedby={helpId}>
            <SelectValue placeholder="Choose a webhook" />
          </SelectTrigger>
          <SelectContent>
            {webhooks.map((webhook) => (
              <SelectItem key={webhook.eventType} value={webhook.eventType}>
                {webhook.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {chosen !== undefined && (
        <p className="text-caption text-muted-foreground">
          {chosen.name} gives its address once, when it is made; find it, or
          make another, under{" "}
          <Link href={WEBHOOKS_HREF} className="underline">
            Webhooks
          </Link>
          .
        </p>
      )}
      <p className="text-caption text-muted-foreground">
        Steps read the call&apos;s data from the data picker, under Workflow
        input.
      </p>
    </>
  );
}

function EventTypeField({
  schedule,
  eventType,
}: {
  readonly schedule: FormField;
  readonly eventType: string | null;
}) {
  const settings = useFormSettings();
  const written = eventType ?? "";
  const shown = { ...schedule, value: written };
  const problems = useFieldProblems(shown, EVENT_WORDS);

  function commit(typed: string) {
    if (typed === written) return;

    const edits = eventEditsOf(schedule, typed);
    settings.onEdit(edits);
  }

  return (
    <Field data-invalid={problems.invalid} onBlur={problems.leave}>
      <FieldLabel htmlFor={problems.ids.control}>Event type</FieldLabel>
      <Input
        key={written}
        id={problems.ids.control}
        className="font-mono"
        placeholder={EVENT_WORDS.placeholder}
        defaultValue={written}
        aria-describedby={problems.describedBy}
        aria-invalid={problems.invalid}
        onBlur={(event) => {
          commit(event.currentTarget.value);
        }}
      />
      <ProblemLines problems={problems} />
    </Field>
  );
}
