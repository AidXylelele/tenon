import {
  isObject,
  type JsonObject,
  type JsonValue,
} from '@/libs/document-text/json';

// What starts a workflow, read from and written to its `schedule` (DSL 1.0.3). Anything the
// forms do not cover stays as `custom` and is kept untouched.

export type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export interface Duration {
  readonly amount: number;
  readonly unit: DurationUnit;
}

export type Trigger =
  | { readonly kind: 'manual' }
  | { readonly kind: 'cron'; readonly expression: string }
  | { readonly kind: 'every'; readonly duration: Duration }
  | { readonly kind: 'after'; readonly duration: Duration }
  | { readonly kind: 'event'; readonly type: string }
  | { readonly kind: 'custom'; readonly schedule: JsonValue };

export const UNITS: readonly DurationUnit[] = [
  'seconds',
  'minutes',
  'hours',
  'days',
];

export function triggerOf(draft: JsonObject): Trigger {
  const schedule = draft.schedule;

  if (schedule === undefined) return { kind: 'manual' };

  if (!isObject(schedule)) return { kind: 'custom', schedule };

  const keys = Object.keys(schedule);

  if (keys.length !== 1) return { kind: 'custom', schedule };

  if (typeof schedule.cron === 'string')
    return { kind: 'cron', expression: schedule.cron };

  for (const kind of ['every', 'after'] as const) {
    const duration = durationOf(schedule[kind]);

    if (duration !== null) return { kind, duration };
  }

  const type = eventTypeOf(schedule.on);

  if (type !== null) return { kind: 'event', type };

  return { kind: 'custom', schedule };
}

export function withTrigger(draft: JsonObject, trigger: Trigger): JsonObject {
  const rest = Object.fromEntries(
    Object.entries(draft).filter(([key]) => key !== 'schedule'),
  );
  const schedule = scheduleOf(trigger);

  if (schedule === undefined) return rest;

  return { ...rest, schedule };
}

// A duration object of one unit (`{ minutes: 5 }`), or null for anything else.
export function durationOf(value: JsonValue | undefined): Duration | null {
  if (!isObject(value)) return null;

  const entries = Object.entries(value);

  if (entries.length !== 1) return null;

  const [unit, amount] = entries[0] ?? [];
  const known = UNITS.find((each) => each === unit);

  if (known === undefined || typeof amount !== 'number') return null;

  return { amount, unit: known };
}

export function durationValue(duration: Duration): JsonObject {
  return { [duration.unit]: duration.amount };
}

// "Started by hand", "Every 5 minutes", "On com.example.order.paid".
export function describeTrigger(trigger: Trigger): string {
  switch (trigger.kind) {
    case 'manual':
      return 'Started by hand or by an application';
    case 'cron':
      return `On the schedule ${trigger.expression} (UTC)`;
    case 'every':
      return `Every ${durationText(trigger.duration)}`;
    case 'after':
      return `${durationText(trigger.duration)} after the previous run completes`;
    case 'event':
      return `When an event of type ${trigger.type} arrives`;
    case 'custom':
      return 'On a schedule written as code';
  }
}

export function startsAutomatically(trigger: Trigger): boolean {
  return trigger.kind !== 'manual';
}

export function durationText(duration: Duration): string {
  const unit =
    duration.amount === 1 ? duration.unit.slice(0, -1) : duration.unit;
  return `${duration.amount} ${unit}`;
}

function scheduleOf(trigger: Trigger): JsonValue | undefined {
  switch (trigger.kind) {
    case 'manual':
      return undefined;
    case 'cron':
      return { cron: trigger.expression };
    case 'every':
      return { every: durationValue(trigger.duration) };
    case 'after':
      return { after: durationValue(trigger.duration) };
    case 'event':
      return { on: { one: { with: { type: trigger.type } } } };
    case 'custom':
      return trigger.schedule;
  }
}

function eventTypeOf(on: JsonValue | undefined): string | null {
  if (!isObject(on) || Object.keys(on).length !== 1) return null;

  const one = on.one;

  if (!isObject(one) || Object.keys(one).length !== 1) return null;

  const filter = one.with;

  if (!isObject(filter) || Object.keys(filter).length !== 1) return null;

  return typeof filter.type === 'string' ? filter.type : null;
}
