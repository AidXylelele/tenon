import {
  Arrival,
  ErrorKind,
  OnError,
  ProblemCode,
  RunMode,
  RunStatus,
  StepStatus,
  TriggerType,
} from '../../../src/domain/enums.js';
import {
  NodeConfigurationError,
  NodeNotFoundError,
  NotATriggerError,
  ReleaseNotFoundError,
  RunFinishedError,
  WorkflowArchivedError,
  WorkflowConflictError,
  WorkflowInactiveError,
} from '../../../src/domain/errors.js';
import type { Graph } from '../../../src/domain/graph.js';
import type {
  NodeFailure,
  StepOutput,
} from '../../../src/domain/interfaces.js';
import { Run } from '../../../src/domain/run.js';
import { Workflow } from '../../../src/domain/workflow.js';
import {
  aGraph,
  aNode,
  aTrigger,
  defaultSettings,
  link,
} from '../../support/automation-builders.js';

const output = (
  port: string,
  items: number,
  bytes = items * 10,
): StepOutput => ({
  port,
  items,
  bytes,
  key: `artifact-${port}-${items}`,
  chunkStarts: [0],
});

const failure = (kind = ErrorKind.User): NodeFailure => ({
  kind,
  message: 'Field total must be a number',
  parameter: 'total',
  item: 2,
  typeUnavailable: false,
});

const LIMITS = { runBytes: 1_000 };

const chain = () =>
  aGraph(
    [aTrigger('start'), aNode('a'), aNode('b')],
    [link('start', 'a'), link('a', 'b')],
  );

const workflowWith = (graph: Graph) => {
  const workflow = Workflow.create({ name: 'Orders', ownerId: 'owner-1' });
  workflow.saveDraft(1, graph, {
    timezone: 'Europe/Kyiv',
    runTimeoutMs: 90_000,
    errorWorkflowId: null,
  });
  return workflow;
};

const testRun = (
  graph: Graph = chain(),
  input: StepOutput[] = [output('main', 3)],
) =>
  workflowWith(graph).startTestRun({
    runId: 'run-1',
    revision: 2,
    triggerNodeId: 'start',
    problems: [],
    input,
    pins: [],
  });

const runningTest = (graph?: Graph, input?: StepOutput[]) => {
  const run = testRun(graph, input);
  run.begin();
  return run;
};

const executeNode = (run: Run, nodeId: string, outputs: StepOutput[]) => {
  expect(run.reach(nodeId)).toBe(Arrival.Execute);
  run.complete(nodeId, 1, outputs, LIMITS);
};

describe('Run', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('starting', () => {
    it('a_test_run_of_the_draft_is_queued_with_the_graph_the_owner_and_the_timeout_it_started_with', () => {
      const workflow = workflowWith(chain());
      const run = workflow.startTestRun({
        runId: 'run-1',
        revision: 2,
        triggerNodeId: 'start',
        problems: [],
        input: [output('main', 3)],
        pins: [],
      });
      expect(run.id).toBe('run-1');
      expect(run.workflowId).toBe(workflow.id);
      expect(run.workflowName).toBe('Orders');
      expect(run.mode).toBe(RunMode.Test);
      expect(run.releaseNumber).toBeNull();
      expect(run.status).toBe(RunStatus.Queued);
      expect(run.trigger).toEqual({
        type: TriggerType.Manual,
        nodeId: 'start',
        key: null,
      });
      expect(run.graph).toBe(workflow.graph);
      expect(run.actingUserId).toBe('owner-1');
      expect(run.timeoutMs).toBe(90_000);
      expect(run.timezone).toBe('Europe/Kyiv');
      expect(run.queuedAt.toISOString()).toBe('2026-10-16T10:00:00.000Z');
    });

    it('a_test_run_needs_the_current_revision_a_draft_without_problems_and_a_trigger_node', () => {
      const workflow = workflowWith(chain());
      const start = (
        overrides: Partial<Parameters<Workflow['startTestRun']>[0]>,
      ) =>
        workflow.startTestRun({
          runId: 'run-1',
          revision: 2,
          triggerNodeId: 'start',
          problems: [],
          input: [],
          pins: [],
          ...overrides,
        });
      expect(() => start({ revision: 1 })).toThrow(WorkflowConflictError);
      expect(() =>
        start({
          problems: [
            {
              nodeId: 'a',
              parameter: null,
              code: ProblemCode.UnknownNodeType,
              message: 'Unknown',
            },
          ],
        }),
      ).toThrow(NodeConfigurationError);
      expect(() => start({ triggerNodeId: 'ghost' })).toThrow(
        NodeNotFoundError,
      );
      expect(() => start({ triggerNodeId: 'a' })).toThrow(NotATriggerError);
      workflow.archive();
      expect(() => start({})).toThrow(WorkflowArchivedError);
    });

    it('a_manual_run_of_a_release_uses_the_release_graph', () => {
      const workflow = workflowWith(chain());
      const release = workflow.publish(2, [], 'owner-1');
      workflow.saveDraft(2, aGraph([aTrigger('other')]), workflow.settings);
      const run = workflow.startManualRun(release, {
        runId: 'run-2',
        triggerNodeId: 'start',
        input: [],
      });
      expect(run.mode).toBe(RunMode.Production);
      expect(run.releaseNumber).toBe(1);
      expect(run.graph).toBe(release.graph);
      expect(() =>
        workflow.startManualRun(release, {
          runId: 'run-3',
          triggerNodeId: 'a',
          input: [],
        }),
      ).toThrow(NotATriggerError);
    });

    it('a_release_of_another_workflow_is_not_run', () => {
      const workflow = workflowWith(chain());
      const foreign = workflowWith(chain()).publish(2, [], 'owner-1');
      expect(() =>
        workflow.startManualRun(foreign, {
          runId: 'run-2',
          triggerNodeId: 'start',
          input: [],
        }),
      ).toThrow(ReleaseNotFoundError);
    });

    it('a_trigger_starts_runs_only_of_the_active_release_and_only_from_its_own_kind_of_node', () => {
      const hook = aNode('hook', {
        type: 'webhook',
        trigger: TriggerType.Webhook,
      });
      const workflow = workflowWith(
        aGraph([hook, aNode('a')], [link('hook', 'a')]),
      );
      const release = workflow.publish(2, [], 'owner-1');
      const trigger = {
        type: TriggerType.Webhook,
        nodeId: 'hook',
        key: 'webhook:endpoint:delivery-1',
      };
      expect(() =>
        workflow.startTriggeredRun(release, { runId: 'r', trigger, input: [] }),
      ).toThrow(WorkflowInactiveError);
      workflow.activate(release, []);
      const run = workflow.startTriggeredRun(release, {
        runId: 'r',
        trigger,
        input: [],
      });
      expect(run.trigger).toEqual(trigger);
      expect(() =>
        workflow.startTriggeredRun(release, {
          runId: 'r',
          trigger: { ...trigger, type: TriggerType.Schedule },
          input: [],
        }),
      ).toThrow(NotATriggerError);
    });

    it('a_run_identifier_is_derived_from_its_trigger_key_and_random_without_one', () => {
      const id = Run.newId('webhook:endpoint:delivery-1');
      expect(Run.newId('webhook:endpoint:delivery-1')).toBe(id);
      expect(Run.newId('webhook:endpoint:delivery-2')).not.toBe(id);
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(Run.newId(null)).not.toBe(Run.newId(null));
    });
  });

  describe('executing', () => {
    it('beginning_moves_a_queued_run_to_running_once', () => {
      const run = testRun();
      run.begin();
      vi.setSystemTime(new Date('2026-10-16T10:05:00.000Z'));
      run.begin();
      expect(run.status).toBe(RunStatus.Running);
      expect(run.startedAt?.toISOString()).toBe('2026-10-16T10:00:00.000Z');
    });

    it('the_run_visits_the_nodes_reachable_from_its_trigger_in_dependency_order', () => {
      const run = testRun(
        aGraph(
          [aTrigger('start'), aNode('a'), aNode('b'), aNode('orphan')],
          [link('start', 'a'), link('a', 'b')],
        ),
      );
      expect(run.order.map((node) => node.id)).toEqual(['start', 'a', 'b']);
    });

    it('the_trigger_hands_on_the_input_of_the_run', () => {
      const run = runningTest();
      expect(run.reach('start')).toBe(Arrival.Done);
      expect(run.step('start')).toMatchObject({
        status: StepStatus.Succeeded,
        outputs: [output('main', 3)],
        attempts: 0,
      });
    });

    it('a_test_run_without_input_takes_the_pin_of_its_trigger', () => {
      const run = workflowWith(chain()).startTestRun({
        runId: 'run-1',
        revision: 2,
        triggerNodeId: 'start',
        problems: [],
        input: [],
        pins: [{ nodeId: 'start', outputs: [output('main', 5)] }],
      });
      run.begin();
      run.reach('start');
      expect(run.step('start')?.outputs).toEqual([output('main', 5)]);
    });

    it('a_node_whose_inputs_received_items_is_executed', () => {
      const run = runningTest();
      run.reach('start');
      expect(run.reach('a')).toBe(Arrival.Execute);
      expect(run.step('a')?.status).toBe(StepStatus.Running);
    });

    it('a_node_none_of_whose_inputs_received_items_is_skipped', () => {
      const run = runningTest(chain(), [output('main', 0)]);
      run.reach('start');
      expect(run.reach('a')).toBe(Arrival.Done);
      expect(run.step('a')?.status).toBe(StepStatus.Skipped);
      expect(run.reach('b')).toBe(Arrival.Done);
      expect(run.step('b')?.status).toBe(StepStatus.Skipped);
    });

    it('a_node_set_to_always_output_data_runs_even_without_items', () => {
      const run = runningTest(
        aGraph(
          [
            aTrigger('start'),
            aNode('a', {
              settings: defaultSettings({ alwaysOutputData: true }),
            }),
          ],
          [link('start', 'a')],
        ),
        [output('main', 0)],
      );
      run.reach('start');
      expect(run.reach('a')).toBe(Arrival.Execute);
      expect(run.inputOf('a').emptyItemWhenSilent).toBe(true);
    });

    it('a_node_with_several_inputs_runs_when_one_of_them_received_items', () => {
      const run = runningTest(
        aGraph(
          [aTrigger('start'), aNode('empty'), aNode('full'), aNode('merge')],
          [
            link('start', 'empty'),
            link('start', 'full'),
            link('empty', 'merge', 'main', 'input1'),
            link('full', 'merge', 'main', 'input2'),
          ],
        ),
      );
      run.reach('start');
      executeNode(run, 'empty', [output('main', 0)]);
      executeNode(run, 'full', [output('main', 2)]);
      expect(run.reach('merge')).toBe(Arrival.Execute);
    });

    it('a_disabled_node_passes_the_items_of_its_first_input_on_unchanged', () => {
      const run = runningTest(
        aGraph(
          [aTrigger('start'), aNode('if'), aNode('off', { disabled: true })],
          [link('start', 'if'), link('if', 'off', 'true')],
        ),
      );
      run.reach('start');
      executeNode(run, 'if', [output('true', 2), output('false', 1)]);
      expect(run.reach('off')).toBe(Arrival.Done);
      expect(run.step('off')?.outputs).toEqual([
        { ...output('true', 2), port: 'main' },
      ]);
    });

    it('a_test_run_uses_the_pin_of_a_node_instead_of_executing_it', () => {
      const run = workflowWith(chain()).startTestRun({
        runId: 'run-1',
        revision: 2,
        triggerNodeId: 'start',
        problems: [],
        input: [output('main', 1)],
        pins: [{ nodeId: 'a', outputs: [output('main', 7)] }],
      });
      run.begin();
      run.reach('start');
      expect(run.reach('a')).toBe(Arrival.Done);
      expect(run.step('a')?.outputs).toEqual([output('main', 7)]);
    });

    it('reaching_a_node_again_repeats_the_first_decision', () => {
      const run = runningTest();
      run.reach('start');
      expect(run.reach('start')).toBe(Arrival.Done);
      expect(run.reach('a')).toBe(Arrival.Execute);
      expect(run.reach('a')).toBe(Arrival.Execute);
      run.complete('a', 1, [output('main', 1)], LIMITS);
      expect(run.reach('a')).toBe(Arrival.Done);
    });

    it('a_node_receives_the_upstream_items_of_each_input_and_every_upstream_output', () => {
      const run = runningTest(
        aGraph(
          [
            aTrigger('start'),
            aNode('if', { name: 'Check' }),
            aNode('merge', {
              settings: defaultSettings({ executeOnce: true }),
            }),
          ],
          [
            link('start', 'if'),
            link('if', 'merge', 'true', 'input2'),
            link('start', 'merge', 'main', 'input1'),
          ],
        ),
      );
      run.reach('start');
      executeNode(run, 'if', [output('true', 2), output('false', 1)]);
      run.reach('merge');
      const input = run.inputOf('merge');
      expect(input.node.id).toBe('merge');
      expect(input.ports).toEqual([
        { port: 'input1', outputs: [output('main', 3)] },
        { port: 'input2', outputs: [output('true', 2)] },
      ]);
      expect(input.upstream).toEqual([
        { nodeId: 'start', name: 'start', outputs: [output('main', 3)] },
        {
          nodeId: 'if',
          name: 'Check',
          outputs: [output('true', 2), output('false', 1)],
        },
      ]);
      expect(input.firstItemOnly).toBe(true);
      expect(input.emptyItemWhenSilent).toBe(false);
    });

    it('a_completed_node_keeps_its_outputs_and_its_attempt', () => {
      const run = runningTest();
      run.reach('start');
      run.reach('a');
      vi.setSystemTime(new Date('2026-10-16T10:00:02.000Z'));
      run.complete('a', 2, [output('main', 4)], LIMITS);
      expect(run.step('a')).toMatchObject({
        status: StepStatus.Succeeded,
        attempts: 2,
        outputs: [output('main', 4)],
      });
      expect(run.step('a')?.finishedAt?.toISOString()).toBe(
        '2026-10-16T10:00:02.000Z',
      );
    });

    it('outputs_beyond_the_run_limit_fail_the_run_and_name_the_node', () => {
      const run = runningTest();
      run.reach('start');
      run.reach('a');
      run.complete('a', 1, [output('main', 1, 1_001)], LIMITS);
      expect(run.status).toBe(RunStatus.Failed);
      expect(run.error).toMatchObject({ nodeId: 'a', kind: ErrorKind.Limit });
      expect(run.reach('b')).toBe(Arrival.Stop);
    });

    it('a_failed_node_set_to_stop_fails_the_run_with_its_error', () => {
      const run = runningTest();
      run.reach('start');
      run.reach('a');
      run.fail('a', 1, failure(), []);
      expect(run.step('a')).toMatchObject({
        status: StepStatus.Failed,
        error: failure(),
        outputs: [],
      });
      expect(run.status).toBe(RunStatus.Failed);
      expect(run.error).toEqual({
        nodeId: 'a',
        kind: ErrorKind.User,
        message: 'Field total must be a number',
      });
      expect(run.reach('b')).toBe(Arrival.Stop);
    });

    it('a_failed_node_set_to_continue_hands_its_input_on_and_the_run_goes_on', () => {
      const run = runningTest(
        aGraph(
          [
            aTrigger('start'),
            aNode('a', {
              settings: defaultSettings({ onError: OnError.Continue }),
            }),
            aNode('b'),
          ],
          [link('start', 'a'), link('a', 'b')],
        ),
      );
      run.reach('start');
      run.reach('a');
      run.fail('a', 1, failure(), []);
      expect(run.status).toBe(RunStatus.Running);
      expect(run.step('a')).toMatchObject({
        status: StepStatus.Failed,
        outputs: [output('main', 3)],
      });
      expect(run.reach('b')).toBe(Arrival.Execute);
    });

    it('a_failed_node_set_to_continue_through_the_error_output_keeps_the_items_the_executor_routed', () => {
      const run = runningTest(
        aGraph(
          [
            aTrigger('start'),
            aNode('a', {
              settings: defaultSettings({ onError: OnError.ErrorOutput }),
            }),
            aNode('handler'),
          ],
          [link('start', 'a'), link('a', 'handler', 'error')],
        ),
      );
      run.reach('start');
      run.reach('a');
      run.fail('a', 1, failure(), [output('error', 3)]);
      expect(run.status).toBe(RunStatus.Running);
      expect(run.reach('handler')).toBe(Arrival.Execute);
    });

    it('a_limit_failure_ends_the_run_whatever_the_node_does_on_error', () => {
      for (const onError of [OnError.Continue, OnError.ErrorOutput]) {
        const run = runningTest(
          aGraph(
            [
              aTrigger('start'),
              aNode('a', { settings: defaultSettings({ onError }) }),
              aNode('b'),
            ],
            [link('start', 'a'), link('a', 'b')],
          ),
        );
        run.reach('start');
        run.reach('a');
        run.fail(
          'a',
          1,
          { ...failure(), kind: ErrorKind.Limit, message: 'Too many items' },
          [output('error', 3)],
        );
        expect(run.status).toBe(RunStatus.Failed);
        expect(run.error).toMatchObject({ nodeId: 'a', kind: ErrorKind.Limit });
        expect(run.step('a')?.outputs).toEqual([]);
        expect(run.reach('b')).toBe(Arrival.Stop);
      }
    });

    it('finishing_a_running_run_succeeds_it', () => {
      const run = runningTest();
      run.finish();
      expect(run.status).toBe(RunStatus.Succeeded);
      expect(run.finishedAt?.toISOString()).toBe('2026-10-16T10:00:00.000Z');
    });
  });

  describe('ending', () => {
    it('a_cancelled_run_starts_no_further_node', () => {
      const run = runningTest();
      run.cancel();
      expect(run.status).toBe(RunStatus.Cancelled);
      expect(run.error).toEqual({
        nodeId: null,
        kind: ErrorKind.Cancelled,
        message: 'The run was cancelled',
      });
      expect(run.reach('start')).toBe(Arrival.Stop);
    });

    it('a_node_that_was_executing_when_the_run_was_cancelled_keeps_its_output', () => {
      const run = runningTest();
      run.reach('start');
      run.reach('a');
      run.cancel();
      run.complete('a', 1, [output('main', 2)], LIMITS);
      expect(run.step('a')?.status).toBe(StepStatus.Succeeded);
      expect(run.status).toBe(RunStatus.Cancelled);
    });

    it('ending_a_cancelled_run_closes_the_steps_still_running', () => {
      const run = runningTest();
      run.reach('start');
      run.reach('a');
      run.cancel();
      run.terminate({
        nodeId: null,
        kind: ErrorKind.Cancelled,
        message: 'The run was cancelled',
      });
      expect(run.step('a')).toMatchObject({
        status: StepStatus.Failed,
        error: { kind: ErrorKind.Cancelled },
      });
      expect(run.step('a')?.finishedAt).not.toBeNull();
      expect(run.status).toBe(RunStatus.Cancelled);
      expect(run.error?.message).toBe('The run was cancelled');
    });

    it('a_queued_run_can_be_cancelled_and_a_finished_one_cannot', () => {
      const run = testRun();
      run.cancel();
      expect(run.status).toBe(RunStatus.Cancelled);
      expect(() => run.cancel()).toThrow(RunFinishedError);
    });

    it('an_engine_side_timeout_fails_the_run_and_the_node_it_was_executing', () => {
      const run = runningTest();
      run.reach('start');
      run.reach('a');
      run.terminate({
        nodeId: null,
        kind: ErrorKind.Timeout,
        message: 'The run timed out',
      });
      expect(run.status).toBe(RunStatus.Failed);
      expect(run.error?.kind).toBe(ErrorKind.Timeout);
      expect(run.step('a')).toMatchObject({
        status: StepStatus.Failed,
        error: expect.objectContaining({ kind: ErrorKind.Timeout }),
      });
    });

    it('an_engine_side_cancellation_cancels_the_run', () => {
      const run = runningTest();
      run.terminate({
        nodeId: null,
        kind: ErrorKind.Cancelled,
        message: 'Cancelled',
      });
      expect(run.status).toBe(RunStatus.Cancelled);
    });

    it('a_finished_run_is_left_unchanged_by_a_late_termination', () => {
      const run = runningTest();
      run.finish();
      run.terminate({
        nodeId: null,
        kind: ErrorKind.Platform,
        message: 'Lost',
      });
      expect(run.status).toBe(RunStatus.Succeeded);
      expect(run.error).toBeNull();
    });
  });
});
