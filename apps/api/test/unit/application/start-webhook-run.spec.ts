import { WebhookEndpointIssuer } from '../../../src/application/services/webhook-endpoint-issuer.js';
import { ResolveWebhook } from '../../../src/application/use-cases/resolve-webhook.js';
import { StartWebhookRun } from '../../../src/application/use-cases/start-webhook-run.js';
import { Role, RunMode, TriggerType } from '../../../src/domain/enums.js';
import { WebhookEndpointNotFoundError } from '../../../src/domain/errors.js';
import { Workflow } from '../../../src/domain/workflow.js';
import {
  aGraph,
  aNode,
  aTrigger,
  link,
} from '../../support/automation-builders.js';
import {
  FakeNodeTypeCatalog,
  FakeSecretCipher,
  InMemoryArtifactStore,
  InMemoryReleaseRepository,
  InMemoryRunRepository,
  InMemoryWebhookEndpointRepository,
  InMemoryWorkflowQueries,
  InMemoryWorkflowRepository,
} from '../../support/automation-fakes.js';
import { aUser } from '../../support/builders.js';

const owner = aUser({ id: 'owner-1', role: Role.Editor });

const hook = () =>
  aTrigger('hook', { type: 'webhook', trigger: TriggerType.Webhook });

const world = async () => {
  const workflow = Workflow.create({ name: 'Orders', ownerId: owner.id });
  workflow.saveDraft(
    1,
    aGraph([hook(), aNode('a')], [link('hook', 'a')]),
    workflow.settings,
  );
  const release = workflow.publish(2, [], owner.id);
  const workflows = new InMemoryWorkflowRepository(workflow);
  const releases = new InMemoryReleaseRepository(release);
  const endpoints = new InMemoryWebhookEndpointRepository();
  const cipher = new FakeSecretCipher();
  await new WebhookEndpointIssuer(endpoints, cipher).issueFor(workflow);
  const [endpoint] = await endpoints.listByWorkflow(workflow.id);
  const catalogue = new FakeNodeTypeCatalog().webhook({
    methods: ['POST'],
    authentication: 'signature',
  });
  const resolve = new ResolveWebhook(
    endpoints,
    new InMemoryWorkflowQueries(workflows, owner, releases),
    cipher,
    catalogue,
  );
  const runs = new InMemoryRunRepository();
  const artifacts = new InMemoryArtifactStore();
  const start = new StartWebhookRun(workflows, releases, runs, artifacts);
  const delivery = (deliveryId: string | null) =>
    start.execute({
      endpointId: endpoint!.id,
      workflowId: workflow.id,
      releaseNumber: 1,
      nodeId: 'hook',
      deliveryId,
      request: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        query: { source: 'shop' },
        body: { order: 7 },
      },
    });
  return {
    workflow,
    release,
    endpoint: endpoint!,
    endpoints,
    resolve,
    runs,
    artifacts,
    delivery,
  };
};

describe('ResolveWebhook', () => {
  it('an_endpoint_of_the_active_release_resolves_with_its_secret_and_settings', async () => {
    const { workflow, release, endpoint, resolve } = await world();
    workflow.activate(release, []);
    expect(await resolve.execute(endpoint.id)).toEqual({
      endpointId: endpoint.id,
      workflowId: workflow.id,
      releaseNumber: 1,
      nodeId: 'hook',
      secret: expect.stringMatching(/^[\w-]{43}$/),
      settings: { methods: ['POST'], authentication: 'signature' },
    });
  });

  it('an_unknown_endpoint_an_inactive_workflow_or_an_unreadable_secret_resolve_to_nothing', async () => {
    const { workflow, release, endpoint, endpoints, resolve } = await world();
    await expect(resolve.execute('unknown')).rejects.toBeInstanceOf(
      WebhookEndpointNotFoundError,
    );
    await expect(resolve.execute(endpoint.id)).rejects.toBeInstanceOf(
      WebhookEndpointNotFoundError,
    );
    workflow.activate(release, []);
    endpoint.rotate({ ciphertext: 'x', keyVersion: 'retired' });
    await endpoints.update(endpoint);
    await expect(resolve.execute(endpoint.id)).rejects.toBeInstanceOf(
      WebhookEndpointNotFoundError,
    );
  });
});

describe('StartWebhookRun', () => {
  it('a_delivery_starts_a_production_run_with_the_request_as_its_item', async () => {
    const { workflow, release, delivery, artifacts } = await world();
    workflow.activate(release, []);
    const run = await delivery('d-1');
    expect(run).toMatchObject({
      mode: RunMode.Production,
      releaseNumber: 1,
      trigger: { type: TriggerType.Webhook, nodeId: 'hook' },
    });
    expect(await artifacts.readAll(run.input)).toEqual([
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        query: { source: 'shop' },
        body: { order: 7 },
      },
    ]);
  });

  it('a_delivery_retried_after_its_run_was_recorded_gets_the_same_run', async () => {
    const { workflow, release, delivery, runs } = await world();
    workflow.activate(release, []);
    const first = await delivery('d-1');
    const retried = await delivery('d-1');
    expect(retried.id).toBe(first.id);
    expect(runs.runs.size).toBe(1);
  });

  it('calls_without_a_delivery_id_start_a_run_each', async () => {
    const { workflow, release, delivery, runs } = await world();
    workflow.activate(release, []);
    const first = await delivery(null);
    const second = await delivery(null);
    expect(second.id).not.toBe(first.id);
    expect(runs.runs.size).toBe(2);
  });
});
