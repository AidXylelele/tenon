import {
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../../../src/application/automation/workflows/ports.js';
import { WorkflowStatus } from '../../../src/domain/automation/workflows/enums.js';
import { Workflow } from '../../../src/domain/automation/workflows/workflow.js';
import { WorkflowName } from '../../../src/domain/automation/workflows/workflow-name.js';
import type { WorkflowVersion } from '../../../src/domain/automation/workflows/workflow-version.js';
import { StaleWriteError } from '../../../src/domain/errors.js';
import { Role } from '../../../src/domain/identity/enums.js';
import { createUser } from '../../support/auth-helpers.js';
import { aDefinition } from '../../support/builders.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { inTransaction, truncateAll } from '../../support/db.js';

const name = new WorkflowName('sales', 'route-lead');
const now = new Date('2026-11-03T10:00:00.000Z');

describe('workflow persistence', () => {
  let t: TestApp;
  let workflows: WorkflowRepository;
  let versions: WorkflowVersionRepository;
  let publisherId: string;

  beforeAll(async () => {
    t = await createTestApp();
    workflows = t.app.get(WorkflowRepository);
    versions = t.app.get(WorkflowVersionRepository);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    const publisher = await createUser(t, {
      email: 'editor@example.com',
      role: Role.Editor,
    });
    publisherId = publisher.id;
  });

  async function publish(
    workflow: Workflow,
    fingerprint = 'f-1',
  ): Promise<WorkflowVersion> {
    const definition = aDefinition({}, fingerprint);
    const result = workflow.publish({
      definition,
      existing: null,
      publisherId,
      now,
    });

    if (!result.ok) throw new Error(result.failure);

    const version = result.value.version;
    await inTransaction(t.app, async () => {
      await workflows.save(workflow);
      await versions.add(version);
    });
    return version;
  }

  it('a_published_version_reads_back_with_its_document', async () => {
    const workflow = Workflow.register(name);
    const version = await publish(workflow);

    const found = await versions.find(name, '1.0.0');
    const byId = await versions.findById(version.id);
    const saved = await workflows.findByName(name);

    expect(found?.document).toEqual(version.document);
    expect(found?.fingerprint).toBe('f-1');
    expect(byId?.id).toBe(version.id);
    expect(saved?.currentVersionId).toBe(version.id);
    expect(saved?.version).toBe(1);
  });

  it('adding_the_same_version_again_writes_nothing', async () => {
    const workflow = Workflow.register(name);
    const version = await publish(workflow);

    await inTransaction(t.app, () => versions.add(version));

    expect((await versions.find(name, '1.0.0'))?.id).toBe(version.id);
  });

  it('archiving_is_saved', async () => {
    const workflow = Workflow.register(name);
    await publish(workflow);
    const loaded = (await workflows.findByName(name))!;

    loaded.archive(now);
    await inTransaction(t.app, () => workflows.save(loaded));

    const archived = await workflows.findByName(name);
    expect(archived?.status).toBe(WorkflowStatus.Archived);
    expect(archived?.archivedAt?.toISOString()).toBe(now.toISOString());
  });

  it('a_stale_copy_of_a_workflow_is_refused', async () => {
    const workflow = Workflow.register(name);
    await publish(workflow);
    const first = (await workflows.findByName(name))!;
    const second = (await workflows.findByName(name))!;
    first.archive(now);
    await inTransaction(t.app, () => workflows.save(first));

    second.archive(now);
    const stale = inTransaction(t.app, () => workflows.save(second));

    await expect(stale).rejects.toThrow(StaleWriteError);
  });

  it('a_workflow_registered_twice_under_one_name_is_a_stale_write', async () => {
    await publish(Workflow.register(name));
    const duplicate = Workflow.register(name);

    const raced = inTransaction(t.app, () => workflows.save(duplicate));

    await expect(raced).rejects.toThrow(StaleWriteError);
  });

  it('another_version_under_a_taken_semver_is_a_stale_write', async () => {
    const workflow = Workflow.register(name);
    await publish(workflow);
    const loaded = (await workflows.findByName(name))!;
    const definition = aDefinition({}, 'f-2');
    const result = loaded.publish({
      definition,
      existing: null,
      publisherId,
      now,
    });
    const version = result.ok ? result.value.version : null;

    const raced = inTransaction(t.app, () => versions.add(version!));

    await expect(raced).rejects.toThrow(StaleWriteError);
  });
});
