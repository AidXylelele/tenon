import { WorkflowPolicy } from '../../../src/application/policies/workflow.policy.js';
import { ConfigurationCheck } from '../../../src/application/services/configuration-check.js';
import { WebhookEndpointIssuer } from '../../../src/application/services/webhook-endpoint-issuer.js';
import { DuplicateWorkflow } from '../../../src/application/use-cases/duplicate-workflow.js';
import { ListWebhookEndpoints } from '../../../src/application/use-cases/list-webhook-endpoints.js';
import { RotateWebhookSecret } from '../../../src/application/use-cases/rotate-webhook-secret.js';
import { SaveDraft } from '../../../src/application/use-cases/save-draft.js';
import { Role, TriggerType } from '../../../src/domain/enums.js';
import {
  WebhookEndpointNotFoundError,
  WorkflowAccessDeniedError,
} from '../../../src/domain/errors.js';
import { Workflow } from '../../../src/domain/workflow.js';
import { defaultSettings } from '../../support/automation-builders.js';
import {
  FakeFormulaEngine,
  FakeNodeTypeCatalog,
  FakeSecretCipher,
  InMemoryWebhookEndpointRepository,
  InMemoryWorkflowQueries,
  InMemoryWorkflowRepository,
} from '../../support/automation-fakes.js';
import { aUser } from '../../support/builders.js';

const owner = aUser({ id: 'owner-1', role: Role.Editor, name: 'Ed' });
const stranger = aUser({ id: 'editor-2', role: Role.Editor });
const policy = new WorkflowPolicy();

const node = (id: string, type: string) => ({
  id,
  name: id,
  type,
  typeVersion: 1,
  parameters: {},
  credentialId: null,
  settings: {},
  position: { x: 0, y: 0 },
  note: null,
  disabled: false,
});

const setup = () => {
  const workflow = Workflow.create({ name: 'Orders', ownerId: owner.id });
  const workflows = new InMemoryWorkflowRepository(workflow);
  const endpoints = new InMemoryWebhookEndpointRepository();
  const cipher = new FakeSecretCipher();
  const catalogue = new FakeNodeTypeCatalog()
    .type('webhook', {
      trigger: TriggerType.Webhook,
      defaultSettings: defaultSettings(),
    })
    .type('noOp', { defaultSettings: defaultSettings() })
    .webhook({ methods: ['POST', 'PUT'], authentication: 'signature' });
  const issuer = new WebhookEndpointIssuer(endpoints, cipher);
  const saveDraft = new SaveDraft(
    workflows,
    catalogue,
    new ConfigurationCheck(catalogue),
    new FakeFormulaEngine(),
    policy,
    issuer,
  );
  const save = (types: Record<string, string>) =>
    saveDraft.execute({
      actor: owner,
      workflowId: workflow.id,
      revision: workflow.revision,
      graph: {
        nodes: Object.entries(types).map(([id, type]) => node(id, type)),
        connections: [],
      },
      settings: workflow.settings,
    });
  const list = new ListWebhookEndpoints(
    new InMemoryWorkflowQueries(workflows, owner),
    endpoints,
    cipher,
    catalogue,
    policy,
  );
  const rotate = new RotateWebhookSecret(
    workflows,
    endpoints,
    cipher,
    catalogue,
    policy,
  );
  return { workflow, workflows, endpoints, issuer, save, list, rotate };
};

describe('webhook endpoints', () => {
  it('saving_a_draft_opens_one_endpoint_per_webhook_node_and_keeps_it_across_saves', async () => {
    const { workflow, endpoints, save } = setup();
    await save({ hook: 'webhook', tidy: 'noOp' });
    const [opened] = await endpoints.listByWorkflow(workflow.id);
    expect(opened).toMatchObject({ workflowId: workflow.id, nodeId: 'hook' });
    expect(opened?.secret.keyVersion).toBe('k1');
    await save({ hook: 'webhook', other: 'webhook' });
    const kept = await endpoints.listByWorkflow(workflow.id);
    expect(kept.map((endpoint) => endpoint.nodeId).sort()).toEqual([
      'hook',
      'other',
    ]);
    expect(kept.find((endpoint) => endpoint.nodeId === 'hook')?.id).toBe(
      opened?.id,
    );
  });

  it('a_copy_gets_endpoints_of_its_own', async () => {
    const { workflow, workflows, endpoints, issuer, save } = setup();
    await save({ hook: 'webhook' });
    const copy = await new DuplicateWorkflow(workflows, issuer).execute({
      actor: stranger,
      workflowId: workflow.id,
      name: null,
    });
    const [original] = await endpoints.listByWorkflow(workflow.id);
    const [copied] = await endpoints.listByWorkflow(copy.id);
    expect(copied?.nodeId).toBe('hook');
    expect(copied?.id).not.toBe(original?.id);
  });

  it('the_owner_reads_each_endpoint_with_its_secret_and_settings', async () => {
    const { workflow, save, list } = setup();
    await save({ hook: 'webhook' });
    const views = await list.execute({ actor: owner, workflowId: workflow.id });
    expect(views).toEqual([
      {
        endpointId: expect.any(String),
        nodeId: 'hook',
        secret: expect.stringMatching(/^[\w-]{43}$/),
        settings: { methods: ['POST', 'PUT'], authentication: 'signature' },
      },
    ]);
    await expect(
      list.execute({ actor: stranger, workflowId: workflow.id }),
    ).rejects.toBeInstanceOf(WorkflowAccessDeniedError);
  });

  it('rotating_replaces_the_secret_of_the_endpoint', async () => {
    const { workflow, save, list, rotate } = setup();
    await save({ hook: 'webhook', tidy: 'noOp' });
    const [before] = await list.execute({
      actor: owner,
      workflowId: workflow.id,
    });
    const rotated = await rotate.execute({
      actor: owner,
      workflowId: workflow.id,
      nodeId: 'hook',
    });
    expect(rotated.endpointId).toBe(before?.endpointId);
    expect(rotated.secret).not.toBe(before?.secret);
    const [after] = await list.execute({
      actor: owner,
      workflowId: workflow.id,
    });
    expect(after?.secret).toBe(rotated.secret);
    await expect(
      rotate.execute({ actor: owner, workflowId: workflow.id, nodeId: 'tidy' }),
    ).rejects.toBeInstanceOf(WebhookEndpointNotFoundError);
    await expect(
      rotate.execute({
        actor: stranger,
        workflowId: workflow.id,
        nodeId: 'hook',
      }),
    ).rejects.toBeInstanceOf(WorkflowAccessDeniedError);
  });
});
