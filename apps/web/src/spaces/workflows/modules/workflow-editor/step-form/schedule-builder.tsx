"use client";

import { CalendarClockIcon } from "lucide-react";
import type { FormField } from "language-server/protocol";
import { type KeyboardEvent, useId, useState } from "react";
import {
  Field,
  FieldDescription,
  FieldLabel,
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
  ToggleGroup,
  ToggleGroupItem,
} from "@/libs/ui/components/toggle-group";
import { cronEditsOf, type FieldWords } from "../form-fields";
import {
  cronOf,
  cronText,
  daylightNote,
  localTimeText,
  nextStartsOf,
  REPEAT_CHOICES,
  type Repeat,
  repeatLabel,
  repeatOf,
  startText,
  type TimeOfDay,
  type Weekday,
} from "@/operations/schedule-words";
import { Disclosure } from "@/libs/ui/composites/disclosure";
import { ProblemLines, useFieldProblems } from "./field-shell";
import { useFormSettings } from "./form-settings";

interface ScheduleBuilderProps {
  readonly schedule: FormField;
  readonly cron: string;
  readonly now: string;
  readonly zone: string;
}

interface RepeatProps<Kind extends Repeat["kind"]> {
  readonly repeat: Extract<Repeat, { readonly kind: Kind }>;
  readonly onRepeat: (next: Repeat) => void;
}

const NEXT_STARTS = 3;

const CUSTOM = "custom";

const EVERY_MINUTES = [5, 10, 15, 20, 30];

const DAYS: readonly { readonly day: Weekday; readonly text: string }[] = [
  { day: 1, text: "Mon" },
  { day: 2, text: "Tue" },
  { day: 3, text: "Wed" },
  { day: 4, text: "Thu" },
  { day: 5, text: "Fri" },
  { day: 6, text: "Sat" },
  { day: 0, text: "Sun" },
];

const CRON_WORDS: FieldWords = {
  title: "Custom schedule (cron)",
  help: "minute, hour, day of month, month, day of week — in UTC. Written for you by the choices above.",
  placeholder: "0 9 * * *",
  fill: "Write the schedule as five parts: minute, hour, day of month, month and day of week.",
  control: "value",
  mono: true,
  choices: new Map(),
};

function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") event.currentTarget.blur();
}

function twoDigits(amount: number): string {
  return String(amount).padStart(2, "0");
}

export function ScheduleBuilder({
  schedule,
  cron,
  now,
  zone,
}: ScheduleBuilderProps) {
  const { onEdit } = useFormSettings();
  const id = useId();
  const repeatId = `${id}-repeat`;
  const repeat = repeatOf(cron);
  const [custom, setCustom] = useState(repeat.kind === CUSTOM);
  const kind = custom ? CUSTOM : repeat.kind;
  const words = cronText(cron);
  const local = localTimeText(cron, now, zone);
  const shift = daylightNote(cron, now, zone);
  const starts = nextStartsOf(cron, now, NEXT_STARTS);
  const startLines = starts.map((start) => startText(start, zone));
  const summary = `cron ${cron}`;

  function write(next: Repeat) {
    const written = cronOf(next);

    if (written === cron) return;

    const edits = cronEditsOf(schedule, written);
    onEdit(edits);
  }

  function chooseRepeat(chosen: string) {
    const isCustom = chosen === CUSTOM;
    setCustom(isCustom);

    if (isCustom) return;

    const choice = REPEAT_CHOICES.find((each) => each.kind === chosen);

    if (choice === undefined) return;

    const next = keptTimeOf(choice, repeat);
    write(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor={repeatId}>Repeat</FieldLabel>
        <Select value={kind} onValueChange={chooseRepeat}>
          <SelectTrigger id={repeatId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPEAT_CHOICES.map((choice) => (
              <SelectItem key={choice.kind} value={choice.kind}>
                {repeatLabel(choice)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {custom ? (
        <CronField schedule={schedule} cron={cron} />
      ) : (
        <RepeatDetails repeat={repeat} onRepeat={write} />
      )}
      <div className="flex flex-col gap-1 rounded-lg border bg-subtle p-3">
        <p className="flex items-center gap-2 font-semibold">
          <CalendarClockIcon
            className="size-4 text-muted-foreground"
            aria-hidden
          />
          {words}
        </p>
        {local !== null && <p className="text-caption">{local}</p>}
        {shift !== null && (
          <p className="text-caption text-muted-foreground">{shift}</p>
        )}
        {startLines.length > 0 && (
          <>
            <p className="mt-1 text-caption font-semibold">Next starts</p>
            <ul className="text-caption">
              {startLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}
      </div>
      {!custom && (
        <Disclosure title="More options" summary={summary}>
          <CronField schedule={schedule} cron={cron} />
        </Disclosure>
      )}
    </div>
  );
}

function keptTimeOf(choice: Repeat, current: Repeat): Repeat {
  const hasTime = "at" in current;

  if (!hasTime) return choice;

  switch (choice.kind) {
    case "daily":
    case "weekdays":
    case "weekly":
      return { ...choice, at: current.at };
    case "hourly":
    case "minutes":
    case "custom":
      return choice;
  }
}

function RepeatDetails({
  repeat,
  onRepeat,
}: {
  readonly repeat: Repeat;
  readonly onRepeat: (next: Repeat) => void;
}) {
  switch (repeat.kind) {
    case "daily":
    case "weekdays":
    case "weekly": {
      const timed = repeat;
      const onTime = (at: TimeOfDay) => {
        onRepeat({ ...timed, at });
      };
      return (
        <>
          {timed.kind === "weekly" && (
            <WeekdaysField repeat={timed} onRepeat={onRepeat} />
          )}
          <TimeField at={timed.at} onTime={onTime} />
        </>
      );
    }
    case "hourly":
      return <MinuteField repeat={repeat} onRepeat={onRepeat} />;
    case "minutes":
      return <EveryField repeat={repeat} onRepeat={onRepeat} />;
    case "custom":
      return null;
  }
}

function TimeField({
  at,
  onTime,
}: {
  readonly at: TimeOfDay;
  readonly onTime: (at: TimeOfDay) => void;
}) {
  const id = useId();
  const written = `${twoDigits(at.hour)}:${twoDigits(at.minute)}`;

  function commit(text: string) {
    const [hour, minute] = text.split(":").map(Number);
    const isTime =
      hour !== undefined &&
      minute !== undefined &&
      !Number.isNaN(hour) &&
      !Number.isNaN(minute);

    if (!isTime) return;

    onTime({ hour, minute });
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>At, in UTC</FieldLabel>
      <Input
        key={written}
        id={id}
        type="time"
        step={60}
        className="w-32"
        defaultValue={written}
        onBlur={(event) => {
          commit(event.currentTarget.value);
        }}
        onKeyDown={blurOnEnter}
      />
    </Field>
  );
}

function WeekdaysField({ repeat, onRepeat }: RepeatProps<"weekly">) {
  const id = useId();
  const value = repeat.days.map(String);

  function choose(chosen: string[]) {
    const picked = DAYS.filter((each) => chosen.includes(String(each.day)));

    if (picked.length === 0) return;

    const next = { ...repeat, days: picked.map((each) => each.day) };
    onRepeat(next);
  }

  return (
    <Field>
      <FieldLabel id={id}>On</FieldLabel>
      <div>
        <ToggleGroup
          type="multiple"
          value={value}
          onValueChange={choose}
          aria-labelledby={id}
        >
          {DAYS.map((each) => (
            <ToggleGroupItem key={each.day} value={String(each.day)}>
              {each.text}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </Field>
  );
}

function MinuteField({ repeat, onRepeat }: RepeatProps<"hourly">) {
  const id = useId();
  const written = String(repeat.minute);

  function commit(text: string) {
    const amount = Number(text);
    const isMinute = Number.isInteger(amount) && amount >= 0 && amount < 60;

    if (!isMinute) return;

    onRepeat({ ...repeat, minute: amount });
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>Minutes past the hour</FieldLabel>
      <Input
        key={written}
        id={id}
        inputMode="numeric"
        className="w-24"
        defaultValue={written}
        onBlur={(event) => {
          commit(event.currentTarget.value);
        }}
        onKeyDown={blurOnEnter}
      />
    </Field>
  );
}

function EveryField({ repeat, onRepeat }: RepeatProps<"minutes">) {
  const id = useId();
  const value = String(repeat.every);

  return (
    <Field>
      <FieldLabel htmlFor={id}>Every</FieldLabel>
      <Select
        value={value}
        onValueChange={(chosen) => {
          const every = Number(chosen);
          onRepeat({ ...repeat, every });
        }}
      >
        <SelectTrigger id={id} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EVERY_MINUTES.map((minutes) => (
            <SelectItem key={minutes} value={String(minutes)}>
              {minutes} minutes
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function CronField({
  schedule,
  cron,
}: {
  readonly schedule: FormField;
  readonly cron: string;
}) {
  const { onEdit } = useFormSettings();
  const cronField = schedule.fields.find((member) => member.key === "cron");
  const shown = cronField ?? schedule;
  const problems = useFieldProblems(shown, CRON_WORDS);

  function commit(typed: string) {
    const written = typed.trim();

    if (written === cron || written === "") return;

    const edits = cronEditsOf(schedule, written);
    onEdit(edits);
  }

  return (
    <Field data-invalid={problems.invalid} onBlur={problems.leave}>
      <FieldLabel htmlFor={problems.ids.control}>{CRON_WORDS.title}</FieldLabel>
      <FieldDescription id={problems.ids.help}>
        {CRON_WORDS.help}
      </FieldDescription>
      <Input
        key={cron}
        id={problems.ids.control}
        className="font-mono"
        placeholder={CRON_WORDS.placeholder}
        defaultValue={cron}
        aria-describedby={problems.describedBy}
        aria-invalid={problems.invalid}
        onBlur={(event) => {
          commit(event.currentTarget.value);
        }}
        onKeyDown={blurOnEnter}
      />
      <ProblemLines problems={problems} />
    </Field>
  );
}
