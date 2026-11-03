import { TaskStatus } from '../../../src/application/automation/instances/enums.js';
import type { JsonObject } from '../../../src/domain/automation/json.js';
import { RunOutcomeKind } from '../../../src/interface-adapters/workflows/enums.js';
import type { RunOutcome } from '../../../src/interface-adapters/workflows/interfaces.js';
import {
  ERRORS,
  RuntimeHarness,
  STARTED_AT,
  aWorkflow,
} from '../../support/runtime-harness.js';

let h: RuntimeHarness;

beforeAll(async () => {
  h = await RuntimeHarness.start();
});

afterAll(async () => {
  await h.close();
});

function schema(document: JsonObject): JsonObject {
  return { format: 'json', document };
}

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

describe('workflow input and output', () => {
  it('input_from_transforms_the_raw_input_and_workflow_input_keeps_the_raw_one', async () => {
    const document = aWorkflow(
      [{ t: { set: { input: '${ . }', raw: '${ $workflow.input }' } } }],
      {
        input: {
          schema: schema({ type: 'object', required: ['order'] }),
          from: '${ .order }',
        },
      },
    );
    const raw = { order: { id: 7 }, noise: true };

    const { outcome } = await h.run(document, raw);

    expect(outputOf(outcome)).toEqual({ input: { id: 7 }, raw });
  });

  it('an_input_against_the_workflow_input_schema_faults_with_a_validation_error_before_any_task', async () => {
    const document = aWorkflow([{ t: { set: { x: 1 } } }], {
      input: { schema: schema({ type: 'object', required: ['order'] }) },
    });

    const { outcome, observer } = await h.run(document, { other: 1 });

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}validation`,
      status: 400,
    });
    expect(observer.started).toHaveLength(0);
  });

  it('the_workflow_input_schema_validates_the_raw_input_before_input_from', async () => {
    const document = aWorkflow([{ t: { set: '${ . }' } }], {
      input: {
        schema: schema({ type: 'object', required: ['order'] }),
        from: '${ .order.id }',
      },
    });

    const { outcome } = await h.run(document, { order: { id: 3 } });

    expect(outputOf(outcome)).toBe(3);
  });

  it('input_from_may_be_an_object_whose_expressions_are_evaluated', async () => {
    const document = aWorkflow([{ t: { set: '${ . }' } }], {
      input: { from: { id: '${ .order.id }', literal: 'kept' } },
    });

    const { outcome } = await h.run(document, { order: { id: 3 } });

    expect(outputOf(outcome)).toEqual({ id: 3, literal: 'kept' });
  });

  it('output_as_shapes_the_last_output_and_sees_the_context', async () => {
    const document = aWorkflow(
      [
        {
          t: {
            set: { total: 10 },
            export: { as: '${ { saved: .total } }' },
          },
        },
      ],
      { output: { as: '${ { result: .total, context: $context } }' } },
    );

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({
      result: 10,
      context: { saved: 10 },
    });
  });

  it('an_output_against_the_workflow_output_schema_faults_with_a_validation_error', async () => {
    const document = aWorkflow([{ t: { set: { total: 'ten' } } }], {
      output: {
        schema: schema({
          type: 'object',
          properties: { total: { type: 'number' } },
        }),
      },
    });

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}validation`,
      status: 400,
    });
  });

  it('the_workflow_output_schema_validates_after_output_as', async () => {
    const document = aWorkflow([{ t: { set: { total: 'ten' } } }], {
      output: {
        as: '${ { total: 10 } }',
        schema: schema({
          type: 'object',
          properties: { total: { type: 'number' } },
        }),
      },
    });

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ total: 10 });
  });

  it('tasks_pass_their_transformed_output_on_as_the_next_raw_input', async () => {
    const document = aWorkflow([
      { a: { set: { n: 1 }, output: { as: '${ { n: (.n + 1) } }' } } },
      { b: { set: { n: '${ .n * 10 }' } } },
    ]);

    const { outcome, observer } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ n: 20 });
    expect(observer.startedNamed('b')[0]?.input).toEqual({ n: 2 });
  });
});

describe('task input, output and export', () => {
  it('input_from_gives_the_task_its_input_as_dot_and_as_input', async () => {
    const document = aWorkflow([
      {
        t: {
          input: { from: '${ .x }' },
          set: { dot: '${ . }', input: '${ $input }' },
        },
      },
    ]);

    const { outcome } = await h.run(document, { x: { v: 1 }, y: 2 });

    expect(outputOf(outcome)).toEqual({ dot: { v: 1 }, input: { v: 1 } });
  });

  it('the_task_input_schema_validates_the_raw_input_before_input_from', async () => {
    const document = aWorkflow([
      {
        t: {
          input: {
            schema: schema({ type: 'object', required: ['x'] }),
            from: '${ .x }',
          },
          set: { got: '${ . }' },
        },
      },
    ]);

    const { outcome } = await h.run(document, { x: 5 });

    expect(outputOf(outcome)).toEqual({ got: 5 });
  });

  it('an_input_against_the_task_input_schema_faults_the_task_with_a_validation_error', async () => {
    const document = aWorkflow([
      { first: { set: { y: 1 } } },
      {
        t: {
          input: { schema: schema({ type: 'object', required: ['x'] }) },
          set: { got: '${ . }' },
        },
      },
    ]);

    const { outcome, observer } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}validation`,
      status: 400,
      instance: '/do/1/t',
    });
    expect(observer.endedNamed('t')[0]?.status).toBe(TaskStatus.Faulted);
  });

  it('output_as_transforms_and_output_schema_validates_the_transformed_output', async () => {
    const document = aWorkflow([
      {
        t: {
          set: { a: 1 },
          output: {
            as: '${ { b: .a } }',
            schema: schema({ type: 'object', required: ['b'] }),
          },
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ b: 1 });
  });

  it('an_output_against_the_task_output_schema_faults_with_a_validation_error', async () => {
    const document = aWorkflow([
      {
        t: {
          set: { a: 1 },
          output: {
            as: '${ { b: .a } }',
            schema: schema({ type: 'object', required: ['a'] }),
          },
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}validation`,
      status: 400,
      instance: '/do/0/t',
    });
  });

  it('export_as_replaces_the_context_which_later_tasks_read_and_merge_into', async () => {
    const document = aWorkflow([
      { a: { set: { v: 1 }, export: { as: '${ { first: .v } }' } } },
      {
        b: {
          set: { v: 2 },
          export: { as: '${ $context + { second: .v } }' },
        },
      },
      { c: { set: { context: '${ $context }' } } },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ context: { first: 1, second: 2 } });
  });

  it('export_as_is_evaluated_on_the_transformed_output_with_output_and_input_bound', async () => {
    const document = aWorkflow([
      {
        a: {
          input: { from: '${ .in }' },
          set: { raw: true },
          output: { as: '${ { shaped: .raw } }' },
          export: { as: '${ { dot: ., output: $output, input: $input } }' },
        },
      },
      { b: { set: '${ $context }' } },
    ]);

    const { outcome } = await h.run(document, { in: 'given' });

    expect(outputOf(outcome)).toEqual({
      dot: { shaped: true },
      output: { shaped: true },
      input: 'given',
    });
  });

  it('a_task_without_export_keeps_the_context', async () => {
    const document = aWorkflow([
      { a: { set: { v: 1 }, export: { as: '${ { kept: .v } }' } } },
      { b: { set: { other: 2 } } },
      { c: { set: '${ $context }' } },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ kept: 1 });
  });

  it('a_context_against_the_export_schema_faults_with_a_validation_error', async () => {
    const document = aWorkflow([
      {
        a: {
          set: { v: 1 },
          export: {
            as: '${ { v: .v } }',
            schema: schema({ type: 'object', required: ['missing'] }),
          },
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}validation`,
      status: 400,
      instance: '/do/0/a',
    });
  });

  it('composite_tasks_transform_their_input_and_output_and_export', async () => {
    const document = aWorkflow([
      {
        outer: {
          input: { from: '${ .payload }' },
          do: [{ inner: { set: { doubled: '${ . * 2 }' } } }],
          output: { as: '${ .doubled }' },
          export: { as: '${ { fromDo: . } }' },
        },
      },
      { after: { set: { value: '${ . }', context: '${ $context }' } } },
    ]);

    const { outcome } = await h.run(document, { payload: 21 });

    expect(outputOf(outcome)).toEqual({
      value: 42,
      context: { fromDo: 42 },
    });
  });
});

describe('runtime expression arguments', () => {
  it('task_workflow_and_runtime_descriptors_are_bound', async () => {
    const document = aWorkflow([
      {
        t: {
          set: {
            name: '${ $task.name }',
            reference: '${ $task.reference }',
            definition: '${ $task.definition.set.name }',
            id: '${ $workflow.id }',
            definitionName: '${ $workflow.definition.document.name }',
            runtime: '${ $runtime.name }',
            version: '${ $runtime.version | type }',
          },
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({
      name: 't',
      reference: '/do/0/t',
      definition: '${ $task.name }',
      id: 'instance-1',
      definitionName: 'probe',
      runtime: 'workflow-platform',
      version: 'string',
    });
  });

  it('the_context_is_bound_in_if_and_input_from', async () => {
    const document = aWorkflow([
      { a: { set: { v: 1 }, export: { as: '${ { gate: true, v: 9 } }' } } },
      {
        b: {
          if: '${ $context.gate }',
          input: { from: '${ $context.v }' },
          set: { got: '${ . }' },
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ got: 9 });
  });

  it('a_text_that_only_contains_an_expression_is_a_literal_in_strict_mode', async () => {
    const document = aWorkflow([
      { t: { set: { greeting: 'Hello ${ .name }' } } },
    ]);

    const { outcome } = await h.run(document, { name: 'Ada' });

    expect(outputOf(outcome)).toEqual({ greeting: 'Hello ${ .name }' });
  });

  it('set_accepts_a_direct_runtime_expression', async () => {
    const document = aWorkflow([{ t: { set: '${ .configuration.color }' } }]);

    const { outcome } = await h.run(document, {
      configuration: { color: 'red' },
    });

    expect(outputOf(outcome)).toBe('red');
  });

  // DSL 1.0.3, "Task Descriptor": `input` is "The task's *raw* input (i.e. *BEFORE* the
  // `input.from` expression)".
  it('the_task_descriptor_input_is_the_raw_input_before_input_from', async () => {
    const document = aWorkflow([
      {
        t: {
          input: { from: '${ .x }' },
          set: { raw: '${ $task.input }' },
        },
      },
    ]);

    const { outcome } = await h.run(document, { x: 1, y: 2 });

    expect(outputOf(outcome)).toEqual({ raw: { x: 1, y: 2 } });
  });

  // "Task Descriptor": `output` is "The task's *raw* output (i.e. *BEFORE* the `output.as`
  // expression)"; `startedAt` is "The start time of the task" (a dateTimeDescriptor).
  it('the_task_descriptor_has_the_raw_output_and_the_start', async () => {
    const document = aWorkflow([
      {
        t: {
          set: { v: 1 },
          output: {
            as: '${ { shaped: true, raw: $task.output, started: ($task.startedAt.iso8601 | type) } }',
          },
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({
      shaped: true,
      raw: { v: 1 },
      started: 'string',
    });
  });

  // "Workflow Descriptor": `startedAt` is a dateTimeDescriptor with `iso8601`, `epoch.seconds`
  // and `epoch.milliseconds`.
  // The task's records and `$task.startedAt` read the engine's clock, which a manual test clock
  // may set apart from the wall clock.
  it('a_task_is_timed_on_the_engine_clock', async () => {
    const engineStart = Date.parse('2030-01-01T00:00:00.000Z');
    const document = aWorkflow([
      { t: { set: { started: '${ $task.startedAt.epoch.milliseconds }' } } },
    ]);

    const { outcome, observer } = await h.run(
      document,
      {},
      {
        clockStart: engineStart,
      },
    );

    expect(outputOf(outcome)).toEqual({ started: engineStart });
    expect(observer.started[0]?.at).toBe('2030-01-01T00:00:00.000Z');
    expect(observer.ended[0]?.at).toBe('2030-01-01T00:00:00.000Z');
  });

  it('the_workflow_start_is_a_date_time_descriptor', async () => {
    const document = aWorkflow([
      {
        t: {
          set: {
            iso: '${ $workflow.startedAt.iso8601 }',
            ms: '${ $workflow.startedAt.epoch.milliseconds }',
          },
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({
      iso: STARTED_AT,
      ms: Date.parse(STARTED_AT),
    });
  });
});

describe('if', () => {
  it('a_false_if_skips_the_task_whose_output_is_its_raw_input', async () => {
    const document = aWorkflow([
      {
        skipped: {
          if: '${ .run }',
          set: { replaced: true },
          export: { as: '${ { exported: true } }' },
        },
      },
      { after: { set: { seen: '${ . }', context: '${ $context }' } } },
    ]);

    const { outcome, observer } = await h.run(document, { run: false });

    expect(outputOf(outcome)).toEqual({ seen: { run: false }, context: {} });
    expect(observer.endedNamed('skipped')[0]?.status).toBe(TaskStatus.Skipped);
    expect(observer.endedNamed('skipped')[0]?.output).toEqual({ run: false });
  });

  it('a_true_if_runs_the_task', async () => {
    const document = aWorkflow([
      { t: { if: '${ .run }', set: { ran: true } } },
    ]);

    const { outcome } = await h.run(document, { run: true });

    expect(outputOf(outcome)).toEqual({ ran: true });
  });

  it('if_is_evaluated_on_the_raw_input_before_the_input_schema_and_input_from', async () => {
    const document = aWorkflow([
      {
        t: {
          if: '${ .flag == true }',
          input: {
            schema: schema({ type: 'object', required: ['payload'] }),
            from: '${ .payload }',
          },
          set: { ran: true },
        },
      },
    ]);

    const { outcome } = await h.run(document, { flag: false });

    expect(outputOf(outcome)).toEqual({ flag: false });
  });

  it('a_false_if_on_a_composite_starts_none_of_its_subtasks', async () => {
    const document = aWorkflow([
      {
        outer: {
          if: '${ false }',
          do: [{ inner: { set: { ran: true } } }],
        },
      },
    ]);

    const { outcome, observer } = await h.run(document, { kept: 1 });

    expect(outputOf(outcome)).toEqual({ kept: 1 });
    expect(observer.startedNamed('inner')).toHaveLength(0);
    expect(observer.endedNamed('outer')[0]?.status).toBe(TaskStatus.Skipped);
  });
});

describe('expression errors', () => {
  const expressionError = {
    type: `${ERRORS}expression`,
    status: 400,
  };

  it('a_failing_set_expression_faults_with_an_expression_error_at_the_task', async () => {
    const document = aWorkflow([{ t: { set: { x: '${ .a.b }' } } }]);

    const { outcome } = await h.run(document, { a: 1 });

    const error = errorOf(outcome);
    expect(error).toMatchObject({ ...expressionError, instance: '/do/0/t' });
    expect(JSON.stringify(error.detail)).toContain('Cannot index number');
  });

  it('a_jq_error_call_gives_its_message_as_the_detail', async () => {
    const document = aWorkflow([{ t: { set: '${ error("boom") }' } }]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      ...expressionError,
      instance: '/do/0/t',
      title: 'Expression Error',
    });
    expect(JSON.stringify(errorOf(outcome).detail)).toContain('boom');
  });

  it('a_failing_if_faults_the_task_with_an_expression_error', async () => {
    const document = aWorkflow([{ t: { if: '${ .a.b }', set: { x: 1 } } }]);

    const { outcome } = await h.run(document, { a: 'text' });

    expect(errorOf(outcome)).toMatchObject({
      ...expressionError,
      instance: '/do/0/t',
    });
  });

  it('a_failing_output_as_in_a_nested_task_points_at_that_task', async () => {
    const document = aWorkflow([
      {
        outer: {
          do: [
            { first: { set: { v: 1 } } },
            { inner: { set: { v: 1 }, output: { as: '${ .v | keys }' } } },
          ],
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      ...expressionError,
      instance: '/do/0/outer/do/1/inner',
    });
  });

  it('a_failing_workflow_input_from_faults_before_any_task', async () => {
    const document = aWorkflow([{ t: { set: { x: 1 } } }], {
      input: { from: '${ .a.b }' },
    });

    const { outcome, observer } = await h.run(document, { a: 3 });

    expect(errorOf(outcome)).toMatchObject(expressionError);
    expect(observer.started).toHaveLength(0);
  });

  it('a_failing_export_as_faults_the_task', async () => {
    const document = aWorkflow([
      { t: { set: { v: 1 }, export: { as: '${ .v.w }' } } },
    ]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      ...expressionError,
      instance: '/do/0/t',
    });
  });
});
