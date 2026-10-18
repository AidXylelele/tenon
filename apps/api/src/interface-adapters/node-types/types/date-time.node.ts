import { DateTime, type DateTimeUnit, Info } from 'luxon';
import { z } from 'zod';
import { CORE_SETTINGS } from '../core-settings.js';
import { ItemPath } from '../item-path.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';
import { NodeUserError } from '../node-user-error.js';

const parameters = z.strictObject({
  operation: z
    .enum([
      'currentDate',
      'addToDate',
      'subtractFromDate',
      'formatDate',
      'roundDate',
      'getTimeBetweenDates',
      'extractDate',
    ])
    .default('currentDate')
    .meta({ title: 'Operation' }),
  date: z.unknown().optional().meta({ title: 'Date' }),
  endDate: z.unknown().optional().meta({ title: 'End date' }),
  amount: z.number().default(1).meta({ title: 'Amount' }),
  unit: z
    .enum([
      'years',
      'quarters',
      'months',
      'weeks',
      'days',
      'hours',
      'minutes',
      'seconds',
      'milliseconds',
    ])
    .default('days')
    .meta({ title: 'Unit' }),
  format: z.string().optional().meta({ title: 'Format' }),
  rounding: z.enum(['down', 'up']).default('down').meta({ title: 'Round' }),
  part: z
    .enum(['year', 'month', 'week', 'day', 'hour', 'minute', 'second'])
    .default('year')
    .meta({ title: 'Part' }),
  timezone: z.string().optional().meta({ title: 'Time zone' }),
  outputField: z
    .string()
    .min(1)
    .default('date')
    .meta({ title: 'Output field' }),
});

type DateTimeParameters = z.infer<typeof parameters>;

type Unit = DateTimeParameters['unit'];

type Part = DateTimeParameters['part'];

export class DateTimeNode implements NodeType<DateTimeParameters> {
  private static readonly STARTS: Readonly<Record<Unit, DateTimeUnit>> = {
    years: 'year',
    quarters: 'quarter',
    months: 'month',
    weeks: 'week',
    days: 'day',
    hours: 'hour',
    minutes: 'minute',
    seconds: 'second',
    milliseconds: 'millisecond',
  };

  readonly id = 'dateTime';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Transform';
  readonly displayName = 'Date & Time';
  readonly description =
    'Gets, shifts, formats, rounds, compares or splits dates in a time zone';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = ['operation'];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<DateTimeParameters>): NodeResult {
    const dated = run.items.map((item, index) => {
      const settings = run.parametersOf(index);
      const zone = this.zone(settings.timezone, run.timezone, index);
      const result = this.result(settings, zone, run.now, index);
      return new ItemPath(settings.outputField, true).write(item, result);
    });

    return { main: dated };
  }

  private zone(
    chosen: string | undefined,
    workflow: string,
    index: number,
  ): string {
    const zone = chosen || workflow;
    const known = Info.isValidIANAZone(zone);

    if (!known) {
      throw new NodeUserError(
        `timezone: ${zone} is not a known IANA time zone`,
        'timezone',
        index,
      );
    }

    return zone;
  }

  private result(
    settings: DateTimeParameters,
    zone: string,
    now: DateTime,
    index: number,
  ): string | number {
    if (settings.operation === 'currentDate') {
      return now.setZone(zone).toISO()!;
    }

    const date = this.dateOf(settings.date, 'date', zone, index);

    switch (settings.operation) {
      case 'addToDate':
      case 'subtractFromDate':
        return this.shifted(date, settings, index);
      case 'formatDate':
        return this.formatted(date, settings.format);
      case 'roundDate':
        return this.rounded(date, settings).toISO()!;
      case 'getTimeBetweenDates':
        return this.between(date, settings, zone, index);
      default:
        return this.partOf(date, settings.part);
    }
  }

  private dateOf(
    value: unknown,
    parameter: string,
    zone: string,
    index: number,
  ): DateTime {
    const date = this.parsed(value, zone);

    if (!date.isValid) {
      throw new NodeUserError(
        `${parameter}: expected an ISO date or epoch milliseconds`,
        parameter,
        index,
      );
    }

    return date;
  }

  private parsed(value: unknown, zone: string): DateTime {
    if (typeof value === 'number') return DateTime.fromMillis(value, { zone });

    if (typeof value === 'string') return DateTime.fromISO(value, { zone });

    return DateTime.invalid('The value is not a date');
  }

  private shifted(
    date: DateTime,
    settings: DateTimeParameters,
    index: number,
  ): string {
    const duration = { [settings.unit]: settings.amount };
    const shifted =
      settings.operation === 'addToDate'
        ? date.plus(duration)
        : date.minus(duration);

    if (!shifted.isValid) {
      throw new NodeUserError(
        'amount: the result is outside the supported date range',
        'amount',
        index,
      );
    }

    return shifted.toISO()!;
  }

  private formatted(date: DateTime, format: string | undefined): string {
    if (!format) return date.toISO()!;

    return date.toFormat(format);
  }

  private rounded(date: DateTime, settings: DateTimeParameters): DateTime {
    const start = date.startOf(DateTimeNode.STARTS[settings.unit]);
    const exact = start.equals(date);

    if (settings.rounding === 'down' || exact) return start;

    return start.plus({ [settings.unit]: 1 });
  }

  private between(
    date: DateTime,
    settings: DateTimeParameters,
    zone: string,
    index: number,
  ): number {
    const end = this.dateOf(settings.endDate, 'endDate', zone, index);
    return end.diff(date, settings.unit).as(settings.unit);
  }

  private partOf(date: DateTime, part: Part): number {
    if (part === 'week') return date.weekNumber;

    return date.get(part);
  }
}
