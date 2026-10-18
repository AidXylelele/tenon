import {
  WebhookEndpointRepository,
  WorkflowRepository,
} from '../../../src/application/interfaces.js';
import { Role } from '../../../src/domain/enums.js';
import { WebhookEndpointConflictError } from '../../../src/domain/errors.js';
import { WebhookEndpoint } from '../../../src/domain/webhook-endpoint.js';
import { Workflow } from '../../../src/domain/workflow.js';
import { createUser } from '../../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { truncateAll } from '../../support/db.js';

describe('DrizzleWebhookEndpointRepository', () => {
  let t: TestApp;
  let endpoints: WebhookEndpointRepository;
  let workflowId: string;

  beforeAll(async () => {
    t = await createTestApp();
    endpoints = t.app.get(WebhookEndpointRepository);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    const owner = await createUser(t, {
      email: 'editor@example.com',
      role: Role.Editor,
    });
    const workflow = Workflow.create({ name: 'Orders', ownerId: owner.id });
    await t.app.get(WorkflowRepository).add(workflow);
    workflowId = workflow.id;
  });

  const opened = () =>
    WebhookEndpoint.open(workflowId, 'hook', {
      ciphertext: 'c1',
      keyVersion: 'k1',
    });

  it('an_endpoint_is_found_by_its_id_by_its_node_and_by_its_workflow', async () => {
    const endpoint = opened();
    await endpoints.add(endpoint);
    const byId = await endpoints.findById(endpoint.id);
    expect(byId).toMatchObject({
      id: endpoint.id,
      workflowId,
      nodeId: 'hook',
      secret: { ciphertext: 'c1', keyVersion: 'k1' },
      rotatedAt: null,
    });
    expect((await endpoints.findByNode(workflowId, 'hook'))?.id).toBe(
      endpoint.id,
    );
    expect(await endpoints.findByNode(workflowId, 'other')).toBeNull();
    expect(await endpoints.findById('missing')).toBeNull();
    expect(
      (await endpoints.listByWorkflow(workflowId)).map((found) => found.id),
    ).toEqual([endpoint.id]);
  });

  it('a_rotated_secret_is_stored_and_a_stale_copy_conflicts', async () => {
    const endpoint = opened();
    await endpoints.add(endpoint);
    const first = (await endpoints.findById(endpoint.id))!;
    const second = (await endpoints.findById(endpoint.id))!;
    first.rotate({ ciphertext: 'c2', keyVersion: 'k2' });
    await endpoints.update(first);
    second.rotate({ ciphertext: 'c3', keyVersion: 'k2' });
    await expect(endpoints.update(second)).rejects.toBeInstanceOf(
      WebhookEndpointConflictError,
    );
    const found = await endpoints.findById(endpoint.id);
    expect(found?.secret).toEqual({ ciphertext: 'c2', keyVersion: 'k2' });
    expect(found?.rotatedAt).toBeInstanceOf(Date);
  });

  it('a_node_has_one_endpoint', async () => {
    await endpoints.add(opened());
    await expect(endpoints.add(opened())).rejects.toBeInstanceOf(
      WebhookEndpointConflictError,
    );
  });
});
