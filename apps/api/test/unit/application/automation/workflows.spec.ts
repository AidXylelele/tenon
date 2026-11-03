import type { Clock } from '../../../../src/application/automation/ports.js';
import { Missing } from '../../../../src/application/automation/enums.js';
import { ArchiveWorkflow } from '../../../../src/application/automation/workflows/archive-workflow.js';
import { CheckDefinition } from '../../../../src/application/automation/workflows/check-definition.js';
import { PublishVersion } from '../../../../src/application/automation/workflows/publish-version.js';
import {
  WorkflowRefusal,
  WorkflowStatus,
} from '../../../../src/domain/automation/workflows/enums.js';
import { WorkflowName } from '../../../../src/domain/automation/workflows/workflow-name.js';
import { aDocument } from '../../../support/builders.js';
import {
  FakeDefinitionChecker,
  InMemoryWorkflowRepository,
  InMemoryWorkflowVersionRepository,
  OwnedSecrets,
  directTransactions,
} from '../../../support/fakes.js';

const now = new Date('2026-11-03T10:00:00.000Z');
const clock: Clock = { now: () => now };
const name = new WorkflowName('sales', 'route-lead');

function setUp() {
  const checker = new FakeDefinitionChecker();
  const workflows = new InMemoryWorkflowRepository();
  const versions = new InMemoryWorkflowVersionRepository(workflows);
  const secrets = new OwnedSecrets();
  const check = new CheckDefinition(
    checker,
    workflows,
    versions,
    secrets,
    clock,
  );
  const transactions = directTransactions();
  const publish = new PublishVersion(check, workflows, versions, transactions);
  const archive = new ArchiveWorkflow(workflows, clock);
  return { checker, workflows, versions, check, publish, archive };
}

describe('publishing a workflow version', () => {
  it('the_first_version_registers_the_workflow_and_becomes_current', async () => {
    const { publish, workflows, versions } = setUp();

    const result = await publish.execute({
      document: aDocument(),
      publisherId: 'author-1',
    });

    expect(result.ok).toBe(true);
    const workflow = await workflows.findByName(name);
    const version = await versions.find(name, '1.0.0');
    expect(workflow?.currentVersionId).toBe(version?.id);
    expect(version?.document).toEqual(aDocument());
  });

  it('the_same_document_again_publishes_nothing_new', async () => {
    const { publish, versions } = setUp();
    await publish.execute({ document: aDocument(), publisherId: 'author-1' });

    const again = await publish.execute({
      document: aDocument(),
      publisherId: 'author-2',
    });

    expect(again.ok && again.value.publication.created).toBe(false);
    expect(versions.versions.size).toBe(1);
  });

  it('other_content_under_the_same_identity_is_refused', async () => {
    const { publish } = setUp();
    await publish.execute({ document: aDocument(), publisherId: 'author-1' });
    const changed = aDocument({}, [{ other: { set: { x: 1 } } }]);

    const result = await publish.execute({
      document: changed,
      publisherId: 'author-1',
    });

    expect(result).toEqual({
      ok: false,
      failure: WorkflowRefusal.VersionTaken,
    });
  });

  it('a_document_the_runtime_refuses_stores_nothing', async () => {
    const { publish, checker, workflows } = setUp();
    const problem = {
      pointer: '/do/0/greet/thn',
      detail: "'thn' is not a property here",
    };
    checker.refused.set('route-lead', problem);

    const result = await publish.execute({
      document: aDocument(),
      publisherId: 'author-1',
    });

    expect(result).toEqual({ ok: false, failure: problem });
    expect(workflows.workflows.size).toBe(0);
  });

  it('checking_answers_what_publishing_would_and_stores_nothing', async () => {
    const { check, workflows, versions } = setUp();

    const result = await check.execute({
      document: aDocument(),
      publisherId: 'author-1',
    });

    expect(result.ok && result.value.publication.created).toBe(true);
    expect(workflows.workflows.size).toBe(0);
    expect(versions.versions.size).toBe(0);
  });
});

describe('archiving a workflow', () => {
  it('an_archived_workflow_takes_no_new_version', async () => {
    const { publish, archive, workflows } = setUp();
    await publish.execute({ document: aDocument(), publisherId: 'author-1' });

    const archived = await archive.execute({ name });
    const next = await publish.execute({
      document: aDocument({ version: '2.0.0' }),
      publisherId: 'author-1',
    });

    expect(archived.ok).toBe(true);
    expect((await workflows.findByName(name))?.status).toBe(
      WorkflowStatus.Archived,
    );
    expect(next).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
  });

  it('an_unknown_workflow_is_not_found', async () => {
    const { archive } = setUp();

    const result = await archive.execute({ name });

    expect(result).toEqual({ ok: false, failure: Missing.Workflow });
  });
});
