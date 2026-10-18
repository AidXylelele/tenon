import { parseSchedule } from '@nestjs/workflows/core';
import { IANAZone } from 'luxon';
import { z } from 'zod';
import type { Recurrence } from '../../../application/interfaces.js';
import { TriggerType } from '../../../domain/enums.js';
import type { NodeParameters } from '../../../domain/interfaces.js';
import { CORE_SETTINGS } from '../core-settings.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';
import { ParameterTree } from '../parameters/parameter-tree.js';

const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

const isCron = (expression: string): boolean => {
  const trimmed = expression.trim();
  const fields = trimmed.split(/\s+/);
  const shorthand = trimmed.startsWith('@');

  if (!shorthand && fields.length !== 5) return false;

  try {
    parseSchedule({ cron: trimmed });
    return true;
  } catch {
    return false;
  }
};

const hour = z.int().min(0).max(23).default(0).meta({ title: 'Hour' });

const minute = z.int().min(0).max(59).default(0).meta({ title: 'Minute' });

const rule = z.discriminatedUnion('interval', [
  z.strictObject({
    interval: z.literal('minutes'),
    every: z.int().min(1).max(1440).meta({ title: 'Every N minutes' }),
  }),
  z.strictObject({
    interval: z.literal('hours'),
    every: z.int().min(1).max(744).meta({ title: 'Every N hours' }),
    minute,
  }),
  z.strictObject({
    interval: z.literal('days'),
    every: z.int().min(1).max(366).meta({ title: 'Every N days' }),
    hour,
    minute,
  }),
  z.strictObject({
    interval: z.literal('weeks'),
    every: z.int().min(1).max(52).meta({ title: 'Every N weeks' }),
    weekdays: z.array(z.enum(WEEKDAYS)).min(1).meta({ title: 'On' }),
    hour,
    minute,
  }),
  z.strictObject({
    interval: z.literal('months'),
    every: z.int().min(1).max(12).meta({ title: 'Every N months' }),
    day: z.int().min(1).max(31).default(1).meta({ title: 'Day of month' }),
    hour,
    minute,
  }),
  z.strictObject({
    interval: z.literal('cron'),
    expression: z
      .string()
      .refine(isCron, 'Must be a cron expression of five fields')
      .meta({ title: 'Cron expression' }),
  }),
]);

const parameters = z.strictObject({
  rules: z
    .array(rule)
    .min(1)
    .max(20)
    .default([{ interval: 'days', every: 1, hour: 0, minute: 0 }])
    .meta({ title: 'Trigger rules' }),
  timezone: z
    .string()
    .refine((zone) => IANAZone.isValidZone(zone), 'Must be an IANA time zone')
    .optional()
    .meta({ title: 'Time zone (the workflow’s when empty)' }),
});

type ScheduleParameters = z.infer<typeof parameters>;

type ScheduleRule = ScheduleParameters['rules'][number];

export class ScheduleTriggerNode implements NodeType<ScheduleParameters> {
  readonly id = 'scheduleTrigger';
  readonly version = 1;
  readonly kind = 'trigger';
  readonly trigger = TriggerType.Schedule;
  readonly category = 'Triggers';
  readonly displayName = 'Schedule Trigger';
  readonly description =
    'Starts a run of the active release at every scheduled time of each rule';
  readonly parameters = parameters;
  readonly inputs = [];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = ['rules', 'timezone'];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<ScheduleParameters>): NodeResult {
    return { main: run.items };
  }

  schedulesOf(raw: NodeParameters): Recurrence[] {
    const sketch = ParameterTree.parse(raw).sketch();
    const parsed = parameters.safeParse(sketch);

    if (!parsed.success) return [];

    const timezone = parsed.data.timezone ?? null;
    return parsed.data.rules.map((entry) =>
      ScheduleTriggerNode.recurrenceOf(entry, timezone),
    );
  }

  private static recurrenceOf(
    entry: ScheduleRule,
    timezone: string | null,
  ): Recurrence {
    if (entry.interval === 'cron') {
      return { kind: 'cron', expression: entry.expression.trim(), timezone };
    }

    return {
      kind: 'rrule',
      expression: ScheduleTriggerNode.rruleOf(entry),
      timezone,
    };
  }

  private static rruleOf(
    entry: Exclude<ScheduleRule, { interval: 'cron' }>,
  ): string {
    switch (entry.interval) {
      case 'minutes':
        return `FREQ=MINUTELY;INTERVAL=${entry.every}`;
      case 'hours':
        return `FREQ=HOURLY;INTERVAL=${entry.every};BYMINUTE=${entry.minute}`;
      case 'days':
        return `FREQ=DAILY;INTERVAL=${entry.every};BYHOUR=${entry.hour};BYMINUTE=${entry.minute}`;
      case 'weeks':
        return `FREQ=WEEKLY;INTERVAL=${entry.every};BYDAY=${entry.weekdays.join(',')};BYHOUR=${entry.hour};BYMINUTE=${entry.minute}`;
      default:
        return `FREQ=MONTHLY;INTERVAL=${entry.every};BYMONTHDAY=${entry.day};BYHOUR=${entry.hour};BYMINUTE=${entry.minute}`;
    }
  }
}
