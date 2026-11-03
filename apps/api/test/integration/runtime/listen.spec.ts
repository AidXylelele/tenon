import type { JsonObject } from '../../../src/domain/automation/json.js';
import { RunOutcomeKind } from '../../../src/interface-adapters/workflows/enums.js';
import type { RunOutcome } from '../../../src/interface-adapters/workflows/interfaces.js';
import {
  ERRORS,
  RuntimeHarness,
  aWorkflow,
} from '../../support/runtime-harness.js';

let h: RuntimeHarness;

beforeAll(async () => {
  h = await RuntimeHarness.start();
});

afterAll(async () => {
  await h.close();
});

function outputOf(outcome: RunOutcome): unknown {
  if (outcome.kind !== RunOutcomeKind.Completed)
    throw new Error(`the run did not complete: ${JSON.stringify(outcome)}`);

  return outcome.output;
}

function errorOf(outcome: RunOutcome): JsonObject {
  if (outcome.kind !== RunOutcomeKind.Faulted)
    throw new Error(`the run did not fault: ${JSON.stringify(outcome)}`);

  return outcome.error;
}

function event(type: string, data: JsonObject, id = type): JsonObject {
  return {
    specversion: '1.0',
    id,
    source: 'https://hospital.test',
    type,
    data,
  };
}

function listening(to: JsonObject, rest: JsonObject = {}): JsonObject {
  return aWorkflow([{ wait: { listen: { to, ...rest } } }]);
}

const TEMPERATURE = 'com.hospital.temperature';
const BPM = 'com.hospital.bpm';

describe('listen', () => {
  it('one_consumes_the_first_matching_event_and_outputs_its_data', async () => {
    const document = listening({ one: { with: { type: TEMPERATURE } } });

    const { outcome, observer, durability } = await h.run(
      document,
      {},
      {
        events: [event(BPM, { bpm: 80 }), event(TEMPERATURE, { t: 39 })],
      },
    );

    expect(outputOf(outcome)).toEqual([{ t: 39 }]);
    expect(observer.listening).toEqual([
      { key: 'instance-1/do/0/wait', types: [TEMPERATURE] },
    ]);
    expect(observer.unlistened).toEqual(['instance-1/do/0/wait']);
    expect(
      durability.calls.filter((call) => call.kind === 'event'),
    ).toHaveLength(2);
  });

  it('read_envelope_outputs_the_whole_events', async () => {
    const document = listening(
      { one: { with: { type: TEMPERATURE } } },
      { read: 'envelope' },
    );
    const temperature = event(TEMPERATURE, { t: 39 });

    const { outcome } = await h.run(document, {}, { events: [temperature] });

    expect(outputOf(outcome)).toEqual([temperature]);
  });

  it('all_waits_for_one_event_of_each_filter_in_arrival_order', async () => {
    const document = listening({
      all: [{ with: { type: TEMPERATURE } }, { with: { type: BPM } }],
    });

    const { outcome } = await h.run(
      document,
      {},
      {
        events: [
          event(BPM, { bpm: 50 }),
          event(BPM, { bpm: 51 }, 'again'),
          event(TEMPERATURE, { t: 37 }),
        ],
      },
    );

    expect(outputOf(outcome)).toEqual([{ bpm: 50 }, { t: 37 }]);
  });

  it('a_filter_attribute_is_a_regular_expression_the_value_must_match_whole', async () => {
    const document = listening({
      one: { with: { type: 'com\\.hospital\\.(bpm|pulse)' } },
    });

    const { outcome } = await h.run(
      document,
      {},
      {
        events: [
          event('com.hospital.bpm.v2', { bpm: 49 }),
          event(BPM, { bpm: 50 }),
        ],
      },
    );

    expect(outputOf(outcome)).toEqual([{ bpm: 50 }]);
  });

  it('no_event_before_the_workflow_deadline_faults_with_a_timeout_and_stops_listening', async () => {
    const document = aWorkflow(
      [{ wait: { listen: { to: { one: { with: { type: TEMPERATURE } } } } } }],
      { timeout: { after: { seconds: 30 } } },
    );

    const { outcome, observer } = await h.run(document, {}, { events: [] });

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}timeout`,
      status: 408,
      instance: '/do/0/wait',
    });
    expect(observer.unlistened).toHaveLength(1);
  });

  it('a_replayed_listen_receives_the_same_events_and_registers_nothing_again', async () => {
    const document = listening({ one: { with: { type: TEMPERATURE } } });
    const first = await h.run(
      document,
      {},
      {
        events: [event(TEMPERATURE, { t: 39 })],
      },
    );

    const second = await h.run(document, {}, { journal: first.journal });

    expect(second.outcome).toEqual(first.outcome);
    expect(second.observer.listening).toEqual([]);
    expect(second.durability.calls.every((call) => call.replayed)).toBe(true);
  });

  // DSL 1.0.3, "Listen" example: a filter `data: ${ .temperature > 38 }` matches an event whose
  // data has a temperature above 38.
  it('a_data_filter_expression_is_evaluated_on_the_event_data', async () => {
    const document = listening({
      any: [{ with: { type: TEMPERATURE, data: '${ .temperature > 38 }' } }],
    });

    const { outcome } = await h.run(
      document,
      {},
      {
        events: [
          event(TEMPERATURE, { temperature: 37 }, 'cold'),
          event(TEMPERATURE, { temperature: 39 }),
        ],
      },
    );

    expect(outputOf(outcome)).toEqual([{ temperature: 39 }]);
  });
});
