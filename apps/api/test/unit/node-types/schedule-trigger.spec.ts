import { ProblemCode, TriggerType } from '../../../src/domain/enums.js';
import { Graph } from '../../../src/domain/graph.js';
import { NodeTypeRegistry } from '../../../src/interface-adapters/node-types/node-type.registry.js';
import { ScheduleTriggerNode } from '../../../src/interface-adapters/node-types/types/schedule-trigger.node.js';
import { aNode } from '../../support/automation-builders.js';

const registry = new NodeTypeRegistry([new ScheduleTriggerNode()]);

const graphWith = (parameters: Record<string, unknown>) =>
  new Graph({
    nodes: [
      aNode('tick', {
        type: 'scheduleTrigger',
        trigger: TriggerType.Schedule,
        parameters,
      }),
    ],
    connections: [],
  });

const rule = (fields: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, { fixed: value }]),
  );

const schedulesOf = (parameters: Record<string, unknown>) =>
  registry.schedulesOf(graphWith(parameters).node('tick'));

const problemsOf = (parameters: Record<string, unknown>) => {
  const graph = graphWith(parameters);
  return registry.problemsOf(graph.node('tick'), graph);
};

describe('Schedule trigger', () => {
  it('is_a_schedule_trigger_without_inputs', () => {
    const type = new ScheduleTriggerNode();
    expect(type.trigger).toBe(TriggerType.Schedule);
    expect(type.inputs).toEqual([]);
  });

  it('runs_daily_at_midnight_unless_configured_otherwise', () => {
    expect(schedulesOf({})).toEqual([
      {
        kind: 'rrule',
        expression: 'FREQ=DAILY;INTERVAL=1;BYHOUR=0;BYMINUTE=0',
        timezone: null,
      },
    ]);
  });

  it('turns_every_interval_rule_into_a_recurrence', () => {
    expect(
      schedulesOf({
        rules: [
          rule({ interval: 'minutes', every: 15 }),
          rule({ interval: 'hours', every: 2, minute: 30 }),
          rule({
            interval: 'weeks',
            every: 1,
            weekdays: ['MO', 'FR'],
            hour: 8,
            minute: 5,
          }),
          rule({ interval: 'months', every: 3, day: 1, hour: 6, minute: 0 }),
          rule({ interval: 'cron', expression: '0 9 * * 1-5' }),
        ],
        timezone: { fixed: 'Europe/Kyiv' },
      }),
    ).toEqual([
      {
        kind: 'rrule',
        expression: 'FREQ=MINUTELY;INTERVAL=15',
        timezone: 'Europe/Kyiv',
      },
      {
        kind: 'rrule',
        expression: 'FREQ=HOURLY;INTERVAL=2;BYMINUTE=30',
        timezone: 'Europe/Kyiv',
      },
      {
        kind: 'rrule',
        expression: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,FR;BYHOUR=8;BYMINUTE=5',
        timezone: 'Europe/Kyiv',
      },
      {
        kind: 'rrule',
        expression: 'FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1;BYHOUR=6;BYMINUTE=0',
        timezone: 'Europe/Kyiv',
      },
      { kind: 'cron', expression: '0 9 * * 1-5', timezone: 'Europe/Kyiv' },
    ]);
  });

  it('a_malformed_cron_a_cron_with_seconds_and_an_unknown_time_zone_are_problems', () => {
    expect(
      problemsOf({
        rules: [rule({ interval: 'cron', expression: '61 * * * *' })],
      }),
    ).toEqual([
      expect.objectContaining({ code: ProblemCode.InvalidParameter }),
    ]);
    expect(
      problemsOf({
        rules: [rule({ interval: 'cron', expression: '* * * * * *' })],
      }),
    ).toEqual([
      expect.objectContaining({ code: ProblemCode.InvalidParameter }),
    ]);
    expect(problemsOf({ timezone: { fixed: 'Mars/Olympus' } })).toEqual([
      expect.objectContaining({
        parameter: 'timezone',
        code: ProblemCode.InvalidParameter,
      }),
    ]);
    expect(schedulesOf({ timezone: { fixed: 'Mars/Olympus' } })).toEqual([]);
  });
});
