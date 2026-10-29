import {
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../../../src/application/automation/workflows/ports.js';
import { WorkflowQueries } from '../../../src/application/automation/workflows/queries.js';
import { DocumentReading } from '../../../src/domain/automation/language/document-reading.js';
import type { ParsedDocument } from '../../../src/domain/automation/language/interfaces.js';
import { WorkflowName } from '../../../src/domain/automation/language/workflow-name.js';
import { WorkflowTarget } from '../../../src/domain/automation/language/workflow-target.js';
import { SourceDocument } from '../../../src/domain/automation/workflows/source-document.js';
import { Workflow } from '../../../src/domain/automation/workflows/workflow.js';
import { WorkflowVersion } from '../../../src/domain/automation/workflows/workflow-version.js';
import { StaleWriteError } from '../../../src/domain/errors.js';
import { Role } from '../../../src/domain/identity/enums.js';
import { createUser } from '../../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { inTransaction, truncateAll } from '../../support/db.js';

const parsed: ParsedDocument = {
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
  let queries: WorkflowQueries;
  let publisherId: string;

  beforeAll(async () => {
    t = await createTestApp();
    workflows = t.app.get(WorkflowRepository);
    versions = t.app.get(WorkflowVersionRepository);
    queries = t.app.get(WorkflowQueries);
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
    const definition = new DocumentReading(parsed, [])
      .build()
      .report([], { workflows: [], versions: [] })
      .publishable();
    const workflow = Workflow.register(definition.workflow);
    const source = SourceDocument.of('json', JSON.stringify(parsed));
    const version = WorkflowVersion.publish({
      workflow,
      definition,
      source,
      publisherId,
      now: new Date('2026-06-01T00:00:00Z'),
    });
    workflow.publish(version);
    await inTransaction(t.app, async () => {
      await workflows.save(workflow);
      await versions.add(version);
    });
    return version;
  }

  it('a_stored_version_comes_back_with_its_definition_rebuilt_from_the_document', async () => {
    const published = await publish();
    const name = new WorkflowName('billing', 'invoice');

    const found = await versions.find(name, '2.0.0');

    expect(found?.id).toBe(published.id);
    expect(found?.definition.body.tasks.map((task) => task.name)).toEqual([
      'total',
    ]);
    expect(found?.definition.document).toEqual(parsed);
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

  it('reference_facts_report_the_workflows_and_versions_that_exist', async () => {
    await publish();
    const invoice = new WorkflowName('billing', 'invoice');
    const refund = new WorkflowName('billing', 'refund');
    const targets = [
      new WorkflowTarget(invoice, '2.0.0'),
      new WorkflowTarget(invoice, '3.0.0'),
      new WorkflowTarget(refund, WorkflowTarget.LATEST),
    ];

    const facts = await queries.referenceFacts(targets);

    expect(facts).toEqual({
      workflows: [{ namespace: 'billing', name: 'invoice' }],
      versions: [{ namespace: 'billing', name: 'invoice', version: '2.0.0' }],
    });
  });
});
