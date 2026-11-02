import { SubWorkflowEnded } from '../../../../../../src/domain/automation/language/answers/sub-workflow-ended.js';
import { Phase } from '../../../../../../src/domain/automation/language/phase.js';
import {
  CallKind,
  RunKind,
  ScriptLanguage,
} from '../../../../../../src/domain/automation/language/enums.js';
import type { Definition } from '../../../../../../src/domain/automation/language/definition.js';
import { ErrorType } from '../../../../../../src/domain/automation/language/error-type.js';
import type { JsonValue } from '../../../../../../src/domain/automation/language/interfaces.js';
import { FlowDirective } from '../../../../../../src/domain/automation/language/flow-directive.js';
import { EntryStage } from '../../../../../../src/domain/automation/language/stages/entry-stage.js';
import { ProcessExited } from '../../../../../../src/domain/automation/language/results/process-exited.js';
import { ProcessTimedOut } from '../../../../../../src/domain/automation/language/results/process-timed-out.js';
import { ServiceResponded } from '../../../../../../src/domain/automation/language/results/service-responded.js';
import {
  answer,
  completedAt,
  definitionOf,
  evaluatedAs,
  now,
  pointerOf,
  scopeOf,
} from '../../../../../support/progress.js';

function responded(id: string, status: number): ServiceResponded {
  return new ServiceResponded({
    id,
    status,
    headers: { 'content-type': 'application/json' },
    content: { id: 1, name: 'Rex' },
    body: '',
    request: { method: 'get', uri: 'https://petstore.example/pet/1' },
    authorization: null,
  });
}

function getPet(output: string | null = null): Definition {
  const args: Record<string, JsonValue> = {
    method: 'get',
    endpoint: { uri: 'https://petstore.example/pet/{petId}' },
  };

  if (output !== null) args.output = output;

  return definitionOf([{ getPet: { call: 'http', with: args } }]);
}

describe('leaf progress', () => {
  it('an_http_call_hands_out_its_evaluated_request_with_the_input_for_the_uri', () => {
    const definition = getPet();
    const scope = scopeOf(definition, '/do/0/getPet', { petId: 1 });

    const work = EntryStage.begin(scope).progress.work(scope);

    expect(work.calls).toEqual([
      {
        id: 'task-1:call',
        kind: CallKind.Http,
        endpoint: {
          uri: 'https://petstore.example/pet/{petId}',
          authentication: null,
        },
        arguments: { method: 'get' },
        authentication: null,
        input: { petId: 1 },
        deadline: null,
      },
    ]);
  });

  it('a_successful_response_gives_its_content_by_default', () => {
    const definition = getPet();
    const scope = scopeOf(definition, '/do/0/getPet', { petId: 1 });
    const calling = EntryStage.begin(scope).progress;

    const ending = calling
      .record(
        answer(calling.work(scope), { respond: (id) => responded(id, 200) }),
        scope,
      )
      .progress.ending();

    expect(ending?.output).toEqual({ id: 1, name: 'Rex' });
  });

  it('the_response_output_format_gives_the_request_headers_status_and_content', () => {
    const definition = getPet('response');
    const scope = scopeOf(definition, '/do/0/getPet', { petId: 1 });
    const calling = EntryStage.begin(scope).progress;

    const ending = calling
      .record(
        answer(calling.work(scope), { respond: (id) => responded(id, 200) }),
        scope,
      )
      .progress.ending();

    expect(ending?.output).toEqual({
      request: { method: 'get', uri: 'https://petstore.example/pet/1' },
      headers: { 'content-type': 'application/json' },
      statusCode: 200,
      content: { id: 1, name: 'Rex' },
    });
  });

  it('an_error_status_faults_the_call_with_a_communication_error_of_that_status', () => {
    const definition = getPet();
    const scope = scopeOf(definition, '/do/0/getPet', { petId: 1 });
    const calling = EntryStage.begin(scope).progress;

    const failure = calling
      .record(
        answer(calling.work(scope), { respond: (id) => responded(id, 404) }),
        scope,
      )
      .progress.ending()?.failure;

    expect(failure?.toJson()).toEqual({
      type: 'https://serverlessworkflow.io/spec/1.0.0/errors/communication',
      status: 404,
      instance: '/do/0/getPet',
      title: 'Communication Error',
      detail: 'The service answered with status 404',
    });
  });

  it('a_script_runs_in_the_sandbox_and_its_output_follows_return', () => {
    const definition = definitionOf([
      {
        greet: {
          run: {
            script: { language: 'js', code: 'console.log(1)' },
            return: 'all',
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/greet', {});
    const running = EntryStage.begin(scope).progress;

    const work = running.work(scope);
    const ending = running
      .record(
        answer(work, {
          exit: (id) =>
            new ProcessExited({ id, code: 3, stdout: '1\n', stderr: '' }),
        }),
        scope,
      )
      .progress.ending();

    expect(work.processes).toEqual([
      {
        id: 'task-1:process',
        kind: RunKind.Script,
        language: ScriptLanguage.JavaScript,
        process: { language: 'js', code: 'console.log(1)' },
        deadline: null,
      },
    ]);
    expect(ending?.output).toEqual({ code: 3, stdout: '1\n', stderr: '' });
  });

  it('a_process_past_its_time_limit_faults_with_a_timeout_error', () => {
    const definition = definitionOf([
      { greet: { run: { shell: { command: 'sleep 99' } } } },
    ]);
    const scope = scopeOf(definition, '/do/0/greet', {});
    const running = EntryStage.begin(scope).progress;

    const failure = running
      .record(
        answer(running.work(scope), { exit: (id) => new ProcessTimedOut(id) }),
        scope,
      )
      .progress.ending()?.failure;

    expect(failure?.status).toBe(408);
  });

  it('a_process_not_awaited_completes_with_its_input_and_is_detached', () => {
    const definition = definitionOf([
      { greet: { run: { shell: { command: 'echo hi' }, await: false } } },
    ]);
    const scope = scopeOf(definition, '/do/0/greet', { a: 1 });

    const progress = EntryStage.begin(scope).progress;

    expect(progress.ending()?.output).toEqual({ a: 1 });
    expect(progress.ending()?.body?.detachedProcess).toEqual(
      expect.objectContaining({ kind: RunKind.Shell }),
    );
  });

  it('an_emitted_event_gets_an_id_a_spec_version_and_a_time', () => {
    const definition = definitionOf([
      {
        greet: {
          emit: {
            event: {
              with: { source: 'https://fake-source.com', type: 'greeted' },
            },
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/greet', {});

    const ending = EntryStage.begin(scope).progress.ending();

    const event = {
      source: 'https://fake-source.com',
      type: 'greeted',
      id: 'task-1',
      specversion: '1.0',
      time: now.toISOString(),
    };
    const emitted = ending?.body?.emitted;
    expect(ending?.output).toEqual(event);
    expect(emitted?.id).toBe('task-1');
    expect(emitted?.source).toBe('https://fake-source.com');
    expect(emitted?.type).toBe('greeted');
    expect(emitted?.time).toEqual(now);
  });

  it('an_event_claiming_a_lifecycle_source_faults_the_task_with_a_runtime_error', () => {
    const definition = definitionOf([
      {
        greet: {
          emit: {
            event: {
              with: {
                source: '/workflows/default/orders/instances/other',
                type: 'io.serverlessworkflow.task.completed.v1',
                id: '7',
              },
            },
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/greet', {});

    const ending = EntryStage.begin(scope).progress.ending();

    expect(ending?.failure?.type).toBe(
      'https://serverlessworkflow.io/spec/1.0.0/errors/runtime',
    );
    expect(ending?.body?.emitted ?? null).toBeNull();
  });

  it('an_event_with_another_source_under_workflows_is_the_authors_and_is_emitted', () => {
    const definition = definitionOf([
      {
        greet: {
          emit: {
            event: {
              with: { source: '/workflows/billing', type: 'invoiced' },
            },
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/greet', {});

    const ending = EntryStage.begin(scope).progress.ending();

    expect(ending?.failure ?? null).toBeNull();
    expect(ending?.body?.emitted?.source).toBe('/workflows/billing');
  });

  it('an_event_whose_source_evaluates_to_no_text_faults_the_task_with_a_runtime_error', () => {
    const definition = definitionOf([
      {
        greet: {
          emit: {
            event: { with: { source: '${ .source }', type: 'greeted' } },
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/greet', {});
    const emitting = EntryStage.begin(scope).progress;
    const work = emitting.work(scope);
    const results = answer(work, { evaluate: evaluatedAs(() => null) });

    const ending = emitting.record(results, scope).progress.ending();

    const runtime = ErrorType.Runtime.errorAt(scope.task.reference, null);
    expect(ending?.failure?.type).toBe(runtime.type);
    expect(ending?.failure?.instance).toBe('/do/0/greet');
  });

  it('an_event_whose_time_evaluates_to_no_timestamp_faults_the_task_with_a_runtime_error', () => {
    const definition = definitionOf([
      {
        greet: {
          emit: {
            event: {
              with: {
                source: 'https://fake-source.com',
                type: 'greeted',
                time: '${ .when }',
              },
            },
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/greet', {});
    const emitting = EntryStage.begin(scope).progress;
    const work = emitting.work(scope);
    const results = answer(work, { evaluate: evaluatedAs(() => 'yesterday') });

    const ending = emitting.record(results, scope).progress.ending();

    expect(ending?.failure?.status).toBe(500);
  });

  it('a_raised_error_faults_the_task_at_its_reference', () => {
    const definition = definitionOf([
      {
        raiseError: {
          raise: {
            error: {
              type: 'https://serverlessworkflow.io/errors/types/compliance',
              status: 400,
              title: 'Compliance Error',
            },
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/raiseError', {});

    const failure = EntryStage.begin(scope).progress.ending()?.failure;

    expect(failure?.toJson()).toEqual({
      type: 'https://serverlessworkflow.io/errors/types/compliance',
      status: 400,
      title: 'Compliance Error',
      instance: '/do/0/raiseError',
    });
  });

  it('an_awaited_sub_workflow_asks_for_its_child_and_completes_with_its_output', () => {
    const definition = definitionOf([
      {
        invoice: {
          run: {
            workflow: {
              namespace: 'billing',
              name: 'send-invoice',
              version: 'latest',
              input: { order: '${ .id }' },
            },
          },
        },
      },
    ]);
    const scope = scopeOf(definition, '/do/0/invoice', { id: 42 });
    const evaluating = EntryStage.begin(scope).progress;
    const awaiting = evaluating.record(
      answer(evaluating.work(scope), { evaluate: evaluatedAs(() => 42) }),
      scope,
    ).progress;

    const sent = new SubWorkflowEnded({
      phase: Phase.Completed,
      output: { sent: true },
      error: null,
    });
    const ending = awaiting.subWorkflowAnswered(sent, scope).progress.ending();

    expect(awaiting.subWorkflow()?.input).toEqual({ order: 42 });
    expect(awaiting.subWorkflow()?.target.workflow.toString()).toBe(
      'billing/send-invoice',
    );
    expect(ending?.output).toEqual({ sent: true });
  });

  it('a_function_call_runs_the_declared_function_with_its_arguments', () => {
    const definition = definitionOf(
      [{ find: { call: 'getPet', with: { petId: 1 } } }],
      {
        functions: {
          getPet: {
            call: 'http',
            with: { method: 'get', endpoint: 'https://petstore.example' },
          },
        },
      },
    );
    const scope = scopeOf(definition, '/do/0/find', {});

    const step = EntryStage.begin(scope);
    const ending = step.progress
      .childEnded(
        pointerOf('/use/functions/getPet'),
        completedAt(definition, '/use/functions/getPet', { name: 'Rex' }),
        scope,
      )
      .progress.ending();

    expect(step.starts).toEqual([
      expect.objectContaining({ input: { petId: 1 } }),
    ]);
    expect(step.starts[0]?.reference.toString()).toBe('/use/functions/getPet');
    expect(ending?.output).toEqual({ name: 'Rex' });
  });

  it('a_declared_function_that_ends_the_workflow_ends_its_call_with_the_directive', () => {
    const definition = definitionOf([{ close: { call: 'finish' } }], {
      functions: { finish: { set: { done: true }, then: 'end' } },
    });
    const scope = scopeOf(definition, '/do/0/close', {});

    const step = EntryStage.begin(scope);
    const ending = step.progress
      .childEnded(
        pointerOf('/use/functions/finish'),
        completedAt(definition, '/use/functions/finish', { done: true }),
        scope,
      )
      .progress.ending();

    expect(ending?.output).toEqual({ done: true });
    expect(ending?.directive).toBe(FlowDirective.End);
  });
});
