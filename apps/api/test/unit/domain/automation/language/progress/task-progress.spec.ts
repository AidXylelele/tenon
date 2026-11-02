import { DueTime } from '../../../../../../src/domain/automation/language/due-time.js';
import { ErrorType } from '../../../../../../src/domain/automation/language/error-type.js';
import { FlowDirective } from '../../../../../../src/domain/automation/language/flow-directive.js';
import { Outcome } from '../../../../../../src/domain/automation/language/outcome.js';
import { ConcludedProgress } from '../../../../../../src/domain/automation/language/progress/concluded-progress.js';
import { OutputStage } from '../../../../../../src/domain/automation/language/stages/output-stage.js';
import { InconsistentProgressError } from '../../../../../../src/domain/errors.js';
import { JsonPointer } from '../../../../../../src/domain/automation/language/json-pointer.js';
import { BodyStage } from '../../../../../../src/domain/automation/language/stages/body-stage.js';
import { EntryStage } from '../../../../../../src/domain/automation/language/stages/entry-stage.js';
import { WorkflowScope } from '../../../../../../src/domain/automation/language/scopes/workflow-scope.js';
import { ValidationFailed } from '../../../../../../src/domain/automation/language/results/validation-failed.js';
import {
  answer,
  definitionOf,
  evaluatedAs,
  now,
  scopeOf,
} from '../../../../../support/progress.js';

describe('TaskProgress', () => {
  it('a_task_with_nothing_to_compute_completes_when_it_begins', () => {
    const definition = definitionOf([{ greet: { set: { greeting: 'hi' } } }]);
    const scope = scopeOf(definition, '/do/0/greet', { name: 'Ann' });

    const step = EntryStage.begin(scope);

    expect(step.progress.ending()?.output).toEqual({ greeting: 'hi' });
  });

  it('the_definition_is_evaluated_on_the_transformed_input_with_input_as_argument', () => {
    const definition = definitionOf([
      { greet: { set: { greeting: '${ .name }' } } },
    ]);
    const scope = scopeOf(definition, '/do/0/greet', { name: 'Ann' });
    const begun = EntryStage.begin(scope).progress;

    const work = begun.work(scope);
    const results = answer(work, { evaluate: evaluatedAs(() => 'Ann') });
    const ended = begun.record(results, scope).progress;

    expect(work.evaluations).toEqual([
      expect.objectContaining({
        id: 'task-1:/do/0/greet/set/greeting',
        program: '.name',
        data: { name: 'Ann' },
        arguments: expect.objectContaining({ input: { name: 'Ann' } }),
      }),
    ]);
    expect(ended.ending()?.output).toEqual({ greeting: 'Ann' });
  });

  it('a_false_condition_skips_the_task_and_its_raw_input_becomes_its_output', () => {
    const definition = definitionOf([
      { greet: { if: '${ .vip }', set: { greeting: 'hi' } } },
    ]);
    const scope = scopeOf(definition, '/do/0/greet', { vip: false });
    const begun = EntryStage.begin(scope).progress;

    const results = answer(begun.work(scope), {
      evaluate: evaluatedAs(() => false),
    });
    const ending = begun.record(results, scope).progress.ending();

    expect(ending?.isSkipped()).toBe(true);
    expect(ending?.output).toEqual({ vip: false });
    expect(ending?.directive).toBe(FlowDirective.Continue);
  });

  it('the_entry_stage_passes_only_the_arguments_the_standard_lists', () => {
    const definition = definitionOf([
      { greet: { if: '${ .vip }', set: { greeting: 'hi' } } },
    ]);
    const scope = scopeOf(definition, '/do/0/greet', { vip: true });

    const work = EntryStage.begin(scope).progress.work(scope);

    const names = Object.keys(work.evaluations[0]?.arguments ?? {});
    expect(names).toEqual(['context', 'task', 'workflow', 'runtime']);
  });

  it('an_input_that_fails_its_schema_faults_the_task_with_a_validation_error', () => {
    const jsonSchema = { type: 'object' };
    const schema = { format: 'json', document: jsonSchema };
    const definition = definitionOf([
      { greet: { input: { schema }, set: { greeting: 'hi' } } },
    ]);
    const scope = scopeOf(definition, '/do/0/greet', 'not an object');
    const begun = EntryStage.begin(scope).progress;

    const work = begun.work(scope);
    const results = answer(work, {
      validate: (id) => new ValidationFailed(id, 'must be object'),
    });
    const failure = begun.record(results, scope).progress.ending()?.failure;

    expect(work.validations).toEqual([
      {
        id: 'task-1:/do/0/greet/input/schema',
        schema: jsonSchema,
        data: 'not an object',
      },
    ]);
    expect(failure?.toJson()).toEqual({
      type: 'https://serverlessworkflow.io/spec/1.0.0/errors/validation',
      status: 400,
      instance: '/do/0/greet',
      title: 'Validation Error',
      detail: 'must be object',
    });
  });

  it('output_as_transforms_the_raw_output_and_export_as_replaces_the_context', () => {
    const definition = definitionOf([
      {
        pick: {
          set: { a: 1, b: 2 },
          output: { as: '${ .a }' },
          export: { as: '${ { last: . } }' },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/pick', {});
    const transforming = EntryStage.begin(scope).progress;

    const outputWork = transforming.work(scope);
    const exporting = transforming.record(
      answer(outputWork, { evaluate: evaluatedAs(() => 1) }),
      scope,
    ).progress;
    const exportWork = exporting.work(scope);
    const ended = exporting.record(
      answer(exportWork, { evaluate: evaluatedAs(() => ({ last: 1 })) }),
      scope,
    ).progress;

    expect(outputWork.evaluations[0]?.arguments).toEqual(
      expect.objectContaining({ input: {}, authorization: null }),
    );
    expect(exportWork.evaluations[0]?.arguments).toEqual(
      expect.objectContaining({ output: 1 }),
    );
    expect(ended.ending()?.output).toBe(1);
    expect(ended.ending()?.contextOr(null)).toEqual({ last: 1 });
  });

  it('an_elapsed_deadline_faults_the_task_with_a_timeout_error', () => {
    const definition = definitionOf([
      {
        call: {
          timeout: { after: { seconds: 5 } },
          call: 'http',
          with: { method: 'get', endpoint: 'https://example.com' },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/call', {});
    const calling = EntryStage.begin(scope).progress;

    const failure = calling.timeOut(scope).ending()?.failure;

    expect(calling.deadline().time).toEqual(new Date(now.getTime() + 5000));
    expect(failure?.type).toBe(
      'https://serverlessworkflow.io/spec/1.0.0/errors/timeout',
    );
    expect(failure?.status).toBe(408);
  });

  it('the_workflow_runs_as_the_root_task_and_starts_its_first_task', () => {
    const definition = definitionOf([
      { first: { set: { a: 1 } } },
      { second: { set: { b: 2 } } },
    ]);
    const scope = new WorkflowScope({
      id: 'root',
      task: definition.root,
      definition,
      rawInput: { x: 1 },
      context: {},
      instanceId: 'instance-1',
      workflowInput: { x: 1 },
      workflowStartedAt: now,
      runtime: { name: 'tenon' },
      variables: {},
      startedAt: now,
      deadline: DueTime.None,
      now,
    });

    const step = EntryStage.begin(scope);

    expect(step.progress).toBeInstanceOf(BodyStage);
    expect(step.starts).toEqual([
      {
        reference: JsonPointer.root().at('do').at(0).at('first'),
        input: { x: 1 },
        variables: {},
      },
    ]);
  });

  it('a_workflow_input_that_breaks_its_schema_faults_the_workflow', () => {
    const definition = definitionOf(
      [{ first: { set: { a: 1 } } }],
      {},
      {
        schema: {
          format: 'json',
          document: { type: 'object', required: ['orderId'] },
        },
      },
    );
    const scope = new WorkflowScope({
      id: 'root',
      task: definition.root,
      definition,
      rawInput: {},
      context: {},
      instanceId: 'instance-1',
      workflowInput: {},
      workflowStartedAt: now,
      runtime: { name: 'tenon' },
      variables: {},
      startedAt: now,
      deadline: DueTime.None,
      now,
    });
    const checking = EntryStage.begin(scope).progress;
    const work = checking.work(scope);

    const failure = checking
      .record(
        answer(work, {
          validate: (id) => new ValidationFailed(id, 'orderId is required'),
        }),
        scope,
      )
      .progress.ending()?.failure;

    expect(work.validations).toHaveLength(1);
    expect(failure?.type).toBe(
      'https://serverlessworkflow.io/spec/1.0.0/errors/validation',
    );
    expect(failure?.instance).toBe('');
  });
});

describe('TaskProgress states', () => {
  const at = new JsonPointer(['do', '0', 'greet']);
  const failure = ErrorType.Runtime.errorAt(at, null);

  it('a_body_stage_around_a_body_that_ended_is_refused', () => {
    const outcome = Outcome.of({ a: 1 });
    const body = new ConcludedProgress(outcome);
    const build = () =>
      new BodyStage({ input: {}, deadline: DueTime.None, body });

    expect(build).toThrow(InconsistentProgressError);
  });

  it('an_output_stage_after_a_failed_body_is_refused', () => {
    const outcome = Outcome.failed(failure);
    const build = () =>
      new OutputStage({ input: {}, deadline: DueTime.None, outcome });

    expect(build).toThrow(InconsistentProgressError);
  });
});
