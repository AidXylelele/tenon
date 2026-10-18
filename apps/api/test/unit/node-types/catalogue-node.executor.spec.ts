import { ErrorKind, OnError } from '../../../src/domain/enums.js';
import type { StepOutput } from '../../../src/domain/interfaces.js';
import type { Run } from '../../../src/domain/run.js';
import { Workflow } from '../../../src/domain/workflow.js';
import { CatalogueNodeExecutor } from '../../../src/interface-adapters/node-types/catalogue-node.executor.js';
import { NodeTypeRegistry } from '../../../src/interface-adapters/node-types/node-type.registry.js';
import { EditFieldsNode } from '../../../src/interface-adapters/node-types/types/edit-fields.node.js';
import { FilterNode } from '../../../src/interface-adapters/node-types/types/filter.node.js';
import { IfNode } from '../../../src/interface-adapters/node-types/types/if.node.js';
import { ManualTriggerNode } from '../../../src/interface-adapters/node-types/types/manual-trigger.node.js';
import { StopAndErrorNode } from '../../../src/interface-adapters/node-types/types/stop-and-error.node.js';
import {
  aGraph,
  aNode,
  aTrigger,
  defaultSettings,
  link,
} from '../../support/automation-builders.js';
import { InMemoryArtifactStore } from '../../support/automation-fakes.js';

const registry = new NodeTypeRegistry([
  new ManualTriggerNode(),
  new EditFieldsNode(),
  new IfNode(),
  new FilterNode(),
  new StopAndErrorNode(),
]);

const items = [
  { name: 'kibble', price: 10 },
  { name: 'litter', price: 25 },
];

const setup = async (
  node: ReturnType<typeof aNode>,
  limits = { items: 10_000, bytes: 16 * 1024 * 1024 },
  given: readonly Record<string, unknown>[] = items,
) => {
  const artifacts = new InMemoryArtifactStore();
  const workflow = Workflow.create({ name: 'Orders', ownerId: 'owner-1' });
  workflow.saveDraft(
    1,
    aGraph(
      [aTrigger('start', { name: 'Start' }), node],
      [link('start', node.id)],
    ),
    { timezone: 'UTC', runTimeoutMs: 60_000, errorWorkflowId: null },
  );
  const input: StepOutput = await artifacts.write(
    { runId: 'run-1', nodeId: 'start', attempt: 0, port: 'main' },
    given,
  );
  const run: Run = workflow.startTestRun({
    runId: 'run-1',
    revision: 2,
    triggerNodeId: 'start',
    problems: [],
    input: [input],
    pins: [],
  });
  run.begin();
  run.reach('start');
  run.reach(node.id);
  const executor = new CatalogueNodeExecutor(registry, artifacts, limits);
  const execute = () =>
    executor.execute({ run, input: run.inputOf(node.id), attempt: 1 });
  return { artifacts, execute };
};

describe('CatalogueNodeExecutor', () => {
  it('executes_the_node_on_its_input_items_and_stores_every_output_port', async () => {
    const { artifacts, execute } = await setup(
      aNode('check', {
        type: 'if',
        parameters: {
          conditions: {
            rules: [
              {
                left: { ref: { node: '$item', path: 'price' } },
                operator: { fixed: 'number:gt' },
                right: { fixed: 15 },
              },
            ],
          },
        },
      }),
    );
    const outcome = await execute();
    expect(outcome.failure).toBeNull();
    expect(
      outcome.outputs.map((output) => [output.port, output.items]),
    ).toEqual([
      ['true', 1],
      ['false', 1],
    ]);
    expect(await artifacts.readAll([outcome.outputs[0]!])).toEqual([items[1]]);
    expect(outcome.outputs[0]?.key).toBe('runs/run-1/nodes/check/a1/true');
  });

  it('formulas_read_upstream_nodes_by_name', async () => {
    const { artifacts, execute } = await setup(
      aNode('set', {
        type: 'editFields',
        parameters: {
          assignments: [
            {
              name: { fixed: 'first' },
              value: { formula: "{{ $('Start').first().json.name }}" },
            },
          ],
          include: { fixed: 'none' },
        },
      }),
    );
    const outcome = await execute();
    expect(await artifacts.readAll(outcome.outputs)).toEqual([
      { first: 'kibble' },
      { first: 'kibble' },
    ]);
  });

  it('the_known_fields_of_the_main_output_are_reported', async () => {
    const { execute } = await setup(aNode('set', { type: 'editFields' }));
    expect((await execute()).fields).toEqual([
      { path: 'name', type: 'string' },
      { path: 'price', type: 'number' },
    ]);
  });

  it('a_node_type_this_process_does_not_know_is_a_platform_failure_that_waits_for_an_update', async () => {
    const { execute } = await setup(
      aNode('x', { type: 'future', typeVersion: 2 }),
    );
    expect((await execute()).failure).toMatchObject({
      kind: ErrorKind.Platform,
      typeUnavailable: true,
    });
  });

  it('data_that_breaks_the_node_contract_is_a_user_failure_with_the_parameter_and_the_item', async () => {
    const { execute } = await setup(
      aNode('set', {
        type: 'editFields',
        parameters: {
          mode: { fixed: 'json' },
          json: { formula: '{{ $json.price > 20 ? 5 : {} }}' },
        },
      }),
    );
    const outcome = await execute();
    expect(outcome.failure).toMatchObject({
      kind: ErrorKind.User,
      parameter: 'json',
      item: 1,
    });
    expect(outcome.outputs).toEqual([]);
  });

  it('a_formula_whose_builtin_throws_is_a_user_failure_with_the_parameter_and_the_item', async () => {
    const { execute } = await setup(
      aNode('set', {
        type: 'editFields',
        parameters: {
          assignments: [
            {
              name: { fixed: 'parsed' },
              value: { formula: '{{ JSON.parse($json.name) }}' },
            },
          ],
        },
      }),
    );
    expect((await execute()).failure).toMatchObject({
      kind: ErrorKind.User,
      parameter: 'assignments.0.value',
      item: 0,
    });
  });

  it('a_failing_node_set_to_the_error_output_sends_its_input_items_there_with_the_error', async () => {
    const { artifacts, execute } = await setup(
      aNode('stop', {
        type: 'stopAndError',
        parameters: { message: { fixed: 'Refused' } },
        settings: defaultSettings({ onError: OnError.ErrorOutput }),
      }),
    );
    const outcome = await execute();
    expect(outcome.failure?.message).toBe('Refused');
    expect(outcome.outputs.map((output) => output.port)).toEqual(['error']);
    expect(await artifacts.readAll(outcome.outputs)).toEqual([
      { ...items[0], error: 'Refused' },
      { ...items[1], error: 'Refused' },
    ]);
  });

  it('a_node_set_to_always_output_data_emits_one_empty_item_when_it_emits_none', async () => {
    const { artifacts, execute } = await setup(
      aNode('filter', {
        type: 'filter',
        parameters: {
          conditions: {
            rules: [
              {
                left: { ref: { node: '$item', path: 'price' } },
                operator: { fixed: 'number:gt' },
                right: { fixed: 100 },
              },
            ],
          },
        },
        settings: defaultSettings({ alwaysOutputData: true }),
      }),
    );
    const outcome = await execute();
    expect(await artifacts.readAll(outcome.outputs)).toEqual([{}]);
  });

  it('a_node_set_to_always_output_data_whose_input_got_no_items_runs_and_emits_one_empty_item', async () => {
    const { artifacts, execute } = await setup(
      aNode('set', {
        type: 'editFields',
        settings: defaultSettings({ alwaysOutputData: true }),
      }),
      undefined,
      [],
    );
    const outcome = await execute();
    expect(outcome.failure).toBeNull();
    expect(await artifacts.readAll(outcome.outputs)).toEqual([{}]);
  });

  it('a_node_set_to_execute_once_receives_only_the_first_item', async () => {
    const { artifacts, execute } = await setup(
      aNode('set', {
        type: 'editFields',
        settings: defaultSettings({ executeOnce: true }),
      }),
    );
    expect(await artifacts.readAll((await execute()).outputs)).toEqual([
      items[0],
    ]);
  });

  it('an_output_above_the_step_limits_fails_the_node_with_a_limit', async () => {
    const { execute } = await setup(aNode('set', { type: 'editFields' }), {
      items: 1,
      bytes: 1_000_000,
    });
    expect((await execute()).failure).toMatchObject({ kind: ErrorKind.Limit });
  });
});
