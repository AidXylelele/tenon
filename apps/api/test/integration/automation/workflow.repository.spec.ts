import {
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../../../src/application/automation/workflows/ports.js';
import { WorkflowName } from '../../../src/domain/automation/language/workflow-name.js';
import { DocumentFormat } from '../../../src/domain/automation/workflows/enums.js';
import { SourceDocument } from '../../../src/domain/automation/workflows/source-document.js';
import { Workflow } from '../../../src/domain/automation/workflows/workflow.js';
import type { WorkflowVersion } from '../../../src/domain/automation/workflows/workflow-version.js';
import { StaleWriteError } from '../../../src/domain/errors.js';
import { Role } from '../../../src/domain/identity/enums.js';
import { DefinitionMapper } from '../../../src/interface-adapters/workflows/definitions/mappers/definition.mapper.js';
import type { JsonObject } from '../../../src/domain/automation/language/interfaces.js';
import type * as Dsl from '../../../src/interface-adapters/workflows/definitions/interfaces.js';
import { createUser } from '../../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { inTransaction, truncateAll } from '../../support/db.js';

const parsed: Dsl.Workflow = {
  document: {
    dsl: '1.0.3',
    namespace: 'billing',
    name: 'invoice',
    version: '2.0.0',
  },
  do: [{ total: { set: { total: '${ .amount * 2 }' } } }],
};

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

  async function publish(): Promise<WorkflowVersion> {
    const document = JSON.parse(JSON.stringify(parsed)) as JsonObject;
    const definition = DefinitionMapper.toDomain(parsed, document);
    const workflow = Workflow.register(definition.workflow);
    const text = JSON.stringify(parsed);
    const source = new SourceDocument({ format: DocumentFormat.Json, text });
    const version = workflow.publish({
      definition,
      source,
      publisherId,
      now: new Date('2026-06-01T00:00:00Z'),
    });
    await inTransaction(t.app, async () => {
      await workflows.save(workflow);
      await versions.add(version);
    });
    return version;
  }

  it('a_stored_version_comes_back_with_its_source', async () => {
    const published = await publish();
    const name = new WorkflowName('billing', 'invoice');

    const found = await versions.find(name, '2.0.0');

    expect(found?.id).toBe(published.id);
    expect(found?.dslVersion).toBe('1.0.3');
    expect(found?.source.text).toBe(JSON.stringify(parsed));
    expect(found?.source.fingerprint).toBe(published.source.fingerprint);
  });

  it('saving_a_workflow_that_changed_meanwhile_is_a_stale_write', async () => {
    await publish();
    const name = new WorkflowName('billing', 'invoice');
    const first = await workflows.findByName(name);
    const second = await workflows.findByName(name);

    if (first === null || second === null)
      throw new Error('the workflow was not stored');

    await inTransaction(t.app, () => workflows.save(first));

    const stale = inTransaction(t.app, () => workflows.save(second));

    await expect(stale).rejects.toThrow(StaleWriteError);
  });

  it('a_second_registration_of_the_same_name_is_a_stale_write', async () => {
    await publish();
    const rival = Workflow.register(new WorkflowName('billing', 'invoice'));

    const raced = inTransaction(t.app, () => workflows.save(rival));

    await expect(raced).rejects.toThrow(StaleWriteError);
  });
});
