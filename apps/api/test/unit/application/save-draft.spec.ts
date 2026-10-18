import type { DraftNode } from '../../../src/application/interfaces.js';
import { WorkflowPolicy } from '../../../src/application/policies/workflow.policy.js';
import { ConfigurationCheck } from '../../../src/application/services/configuration-check.js';
import { WebhookEndpointIssuer } from '../../../src/application/services/webhook-endpoint-issuer.js';
import { SaveDraft } from '../../../src/application/use-cases/save-draft.js';
import {
  OnError,
  ProblemCode,
  Role,
  TriggerType,
} from '../../../src/domain/enums.js';
import {
  InvalidGraphError,
  WorkflowAccessDeniedError,
  WorkflowConflictError,
} from '../../../src/domain/errors.js';
import { Workflow } from '../../../src/domain/workflow.js';
import { defaultSettings } from '../../support/automation-builders.js';
import {
  FakeFormulaEngine,
  FakeNodeTypeCatalog,
  FakeSecretCipher,
  InMemoryWebhookEndpointRepository,
  InMemoryWorkflowRepository,
} from '../../support/automation-fakes.js';
import { aUser } from '../../support/builders.js';

const owner = aUser({ id: 'owner-1', role: Role.Editor });
const settings = {
  timezone: 'UTC',
  runTimeoutMs: 60_000,
  errorWorkflowId: null,
};

const draftNode = (
  id: string,
  overrides: Partial<DraftNode> = {},
): DraftNode => ({
  id,
  name: id,
  type: 'noOp',
  typeVersion: 1,
  parameters: {},
  credentialId: null,
  settings: {},
  position: { x: 0, y: 0 },
  note: null,
  disabled: false,
  ...overrides,
});

const setup = () => {
  const workflow = Workflow.create({ name: 'Orders', ownerId: owner.id });
  const workflows = new InMemoryWorkflowRepository(workflow);
  const catalogue = new FakeNodeTypeCatalog()
    .type('manualTrigger', {
      trigger: TriggerType.Manual,
      defaultSettings: defaultSettings(),
    })
    .type('noOp', {
      defaultSettings: defaultSettings({ retry: { attempts: 3, waitMs: 500 } }),
    });
  const useCase = new SaveDraft(
    workflows,
    catalogue,
    new ConfigurationCheck(catalogue),
    new FakeFormulaEngine(),
    new WorkflowPolicy(),
    new WebhookEndpointIssuer(
      new InMemoryWebhookEndpointRepository(),
      new FakeSecretCipher(),
    ),
  );
  const save = (
    nodes: DraftNode[],
    connections = [{ from: 'start', output: 'main', to: 'a', input: 'main' }],
    revision = workflow.revision,
    actor = owner,
  ) =>
    useCase.execute({
      actor,
      workflowId: workflow.id,
      revision,
      graph: { nodes, connections },
      settings,
    });
  return { workflow, catalogue, save };
};

describe('SaveDraft', () => {
  it('the_owner_replaces_the_draft_and_gets_the_next_revision', async () => {
    const { workflow, save } = setup();
    const saved = await save([
      draftNode('start', { type: 'manualTrigger' }),
      draftNode('a'),
    ]);
    expect(saved.workflow.revision).toBe(2);
    expect(saved.problems).toEqual([]);
    expect(workflow.graph.nodes.map((node) => node.id)).toEqual(['start', 'a']);
    expect(workflow.settings).toEqual(settings);
  });

  it('the_trigger_kind_comes_from_the_catalogue_and_never_from_the_client', async () => {
    const { workflow, save } = setup();
    await save([draftNode('start', { type: 'manualTrigger' }), draftNode('a')]);
    expect(workflow.graph.node('start').trigger).toBe(TriggerType.Manual);
    expect(workflow.graph.node('a').trigger).toBeNull();
  });

  it('omitted_settings_take_the_defaults_of_the_node_type', async () => {
    const { workflow, save } = setup();
    await save([
      draftNode('start', { type: 'manualTrigger' }),
      draftNode('a', {
        settings: { onError: OnError.Continue, retry: { waitMs: 9 } },
      }),
    ]);
    expect(workflow.graph.node('a').settings).toEqual(
      defaultSettings({
        onError: OnError.Continue,
        retry: { attempts: 3, waitMs: 9 },
      }),
    );
  });

  it('a_node_of_an_unknown_type_is_saved_with_the_platform_defaults_and_its_problem', async () => {
    const { workflow, catalogue, save } = setup();
    catalogue.failing('ghost', {
      nodeId: 'ghost',
      parameter: null,
      code: ProblemCode.UnknownNodeType,
      message: 'Unknown',
    });
    const saved = await save(
      [
        draftNode('start', { type: 'manualTrigger' }),
        draftNode('ghost', { type: 'missing' }),
      ],
      [{ from: 'start', output: 'main', to: 'ghost', input: 'main' }],
    );
    expect(saved.problems).toEqual([
      expect.objectContaining({ code: ProblemCode.UnknownNodeType }),
    ]);
    expect(workflow.graph.node('ghost').settings).toEqual(defaultSettings());
  });

  it('a_malformed_graph_is_refused_and_changes_nothing', async () => {
    const { workflow, save } = setup();
    await expect(
      save([draftNode('a'), draftNode('b', { name: 'a' })], []),
    ).rejects.toBeInstanceOf(InvalidGraphError);
    expect(workflow.revision).toBe(1);
  });

  it('a_stale_revision_is_a_conflict', async () => {
    const { save } = setup();
    await save([draftNode('start', { type: 'manualTrigger' }), draftNode('a')]);
    await expect(
      save(
        [draftNode('start', { type: 'manualTrigger' }), draftNode('a')],
        undefined,
        1,
      ),
    ).rejects.toBeInstanceOf(WorkflowConflictError);
  });

  it('another_editor_cannot_change_the_draft_but_an_administrator_can', async () => {
    const { save } = setup();
    const nodes = [
      draftNode('start', { type: 'manualTrigger' }),
      draftNode('a'),
    ];
    await expect(
      save(nodes, undefined, 1, aUser({ id: 'other', role: Role.Editor })),
    ).rejects.toBeInstanceOf(WorkflowAccessDeniedError);
    await expect(
      save(nodes, undefined, 1, aUser({ id: 'admin', role: Role.Admin })),
    ).resolves.toBeDefined();
  });

  it('renaming_a_node_rewrites_the_formulas_that_name_it', async () => {
    const { workflow, save } = setup();
    const formula = { formula: "{{ $('Fetch').item.json.id }}" };
    await save(
      [
        draftNode('start', { type: 'manualTrigger' }),
        draftNode('fetch', { name: 'Fetch' }),
        draftNode('a', { parameters: { id: formula } }),
      ],
      [
        { from: 'start', output: 'main', to: 'fetch', input: 'main' },
        { from: 'fetch', output: 'main', to: 'a', input: 'main' },
      ],
    );
    await save(
      [
        draftNode('start', { type: 'manualTrigger' }),
        draftNode('fetch', { name: 'Load' }),
        draftNode('a', { parameters: { id: formula } }),
      ],
      [
        { from: 'start', output: 'main', to: 'fetch', input: 'main' },
        { from: 'fetch', output: 'main', to: 'a', input: 'main' },
      ],
    );
    expect(workflow.graph.node('a').parameters).toEqual({
      id: { formula: "{{ $('Load').item.json.id }}" },
    });
  });

  it('swapping_the_names_of_two_nodes_swaps_them_in_formulas', async () => {
    const { workflow, save } = setup();
    const formula = {
      formula: "{{ $('First').item.json.id + $('Second').item.json.id }}",
    };
    const nodes = (first: string, second: string) => [
      draftNode('start', { type: 'manualTrigger' }),
      draftNode('one', { name: first }),
      draftNode('two', { name: second }),
      draftNode('a', { parameters: { id: formula } }),
    ];
    const connections = [
      { from: 'start', output: 'main', to: 'one', input: 'main' },
      { from: 'one', output: 'main', to: 'two', input: 'main' },
      { from: 'two', output: 'main', to: 'a', input: 'main' },
    ];
    await save(nodes('First', 'Second'), connections);
    await save(nodes('Second', 'First'), connections);
    expect(workflow.graph.node('a').parameters).toEqual({
      id: {
        formula: "{{ $('Second').item.json.id + $('First').item.json.id }}",
      },
    });
  });
});
