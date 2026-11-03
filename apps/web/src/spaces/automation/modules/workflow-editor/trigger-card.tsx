'use client';

import { CalendarClockIcon, HandIcon, RadioIcon } from 'lucide-react';
import type { JsonObject } from '@/libs/data-access/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/libs/ui/components/card';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/libs/ui/components/toggle-group';
import {
  describeTrigger,
  type Duration,
  type Trigger,
  triggerOf,
  withTrigger,
} from '../../__shared_context/document/trigger';
import { ChoiceField, DurationField, TextField } from './forms/fields';

const CRON_PRESETS = [
  { value: '*/15 * * * *', label: 'Every 15 minutes' },
  { value: '0 * * * *', label: 'Every hour' },
  { value: '0 9 * * *', label: 'Every day at 09:00 UTC' },
  { value: '0 9 * * 1', label: 'Every Monday at 09:00 UTC' },
  { value: '0 0 1 * *', label: 'On the first of each month' },
];

const MINUTE: Duration = { amount: 5, unit: 'minutes' };

type Mode = 'manual' | 'schedule' | 'event';

interface TriggerCardProps {
  readonly draft: JsonObject;
  readonly onChange: (draft: JsonObject) => void;
}

// What starts the workflow: by hand, on a schedule, or when an event arrives (002 US4). A
// schedule starts runs only while the workflow is turned on.
export function TriggerCard({ draft, onChange }: TriggerCardProps) {
  const trigger = triggerOf(draft);
  const mode: Mode =
    trigger.kind === 'manual'
      ? 'manual'
      : trigger.kind === 'event'
        ? 'event'
        : 'schedule';
  const write = (next: Trigger) => onChange(withTrigger(draft, next));

  function choose(next: string) {
    if (next === 'manual') write({ kind: 'manual' });

    if (next === 'schedule') write({ kind: 'every', duration: MINUTE });

    if (next === 'event')
      write({ kind: 'event', type: 'com.example.order.paid' });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start</CardTitle>
        <CardDescription>{describeTrigger(trigger)}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          type="single"
          variant="outline"
          value={mode}
          onValueChange={(next) => next !== '' && choose(next)}
          className="flex-wrap justify-start"
        >
          <ToggleGroupItem value="manual">
            <HandIcon />
            By hand
          </ToggleGroupItem>
          <ToggleGroupItem value="schedule">
            <CalendarClockIcon />
            On a schedule
          </ToggleGroupItem>
          <ToggleGroupItem value="event">
            <RadioIcon />
            When an event arrives
          </ToggleGroupItem>
        </ToggleGroup>
        {mode === 'schedule' && (
          <ScheduleFields trigger={trigger} write={write} />
        )}
        {trigger.kind === 'event' && (
          <TextField
            id="trigger-event"
            label="Event type"
            at="schedule/on"
            mono
            value={trigger.type}
            onChange={(type) => write({ kind: 'event', type })}
            description="A webhook, an application or another workflow sends it; each event starts one run with the event as input."
          />
        )}
        {mode !== 'manual' && (
          <p className="text-xs text-muted-foreground">
            Runs start by themselves only after you turn the workflow on, on its
            page.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleFields({
  trigger,
  write,
}: {
  readonly trigger: Trigger;
  readonly write: (next: Trigger) => void;
}) {
  if (trigger.kind === 'custom')
    return (
      <p className="text-sm text-muted-foreground">
        This schedule is written as code; edit it in the code view.
      </p>
    );

  const kind =
    trigger.kind === 'cron' || trigger.kind === 'after'
      ? trigger.kind
      : 'every';
  const interval = trigger.kind === 'after' ? 'after' : 'every';
  const duration =
    trigger.kind === 'every' || trigger.kind === 'after'
      ? trigger.duration
      : MINUTE;

  return (
    <div className="flex flex-col gap-4">
      <ChoiceField
        id="trigger-kind"
        label="Repeat"
        at="schedule"
        exact
        value={kind}
        onChange={(next) => {
          if (next === 'cron') write({ kind: 'cron', expression: '0 9 * * *' });
          else write({ kind: next === 'after' ? 'after' : 'every', duration });
        }}
        options={[
          { value: 'every', label: 'At a fixed interval' },
          { value: 'after', label: 'A while after the previous run completes' },
          { value: 'cron', label: 'On a calendar (cron)' },
        ]}
      />
      {trigger.kind === 'cron' ? (
        <div className="flex flex-col gap-2">
          <TextField
            id="trigger-cron"
            label="Cron expression"
            at="schedule/cron"
            mono
            value={trigger.expression}
            onChange={(expression) => write({ kind: 'cron', expression })}
            description="Minute, hour, day of month, month, day of week, in UTC."
          />
          <div className="flex flex-wrap gap-1.5">
            {CRON_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() =>
                  write({ kind: 'cron', expression: preset.value })
                }
                className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <DurationField
          id="trigger-duration"
          label={interval === 'after' ? 'Wait after each run' : 'Every'}
          at={`schedule/${interval}`}
          value={duration}
          onChange={(next) => write({ kind: interval, duration: next })}
        />
      )}
    </div>
  );
}
