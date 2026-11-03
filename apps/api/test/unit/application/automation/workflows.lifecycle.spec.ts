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
  directTransactions,
} from '../../../support/fakes.js';
import {
  FixedClock,
  StoredWorkflowRepository,
  StoredWorkflowVersionRepository,
  T0,
} from '../../../support/qa-fakes.js';

const later = new Date('2026-11-03T12:00:00.000Z');
const name = new WorkflowName('sales', 'route-lead');
const changedTasks = [{ other: { set: { x: 1 } } }];

function setUp() {
  const clock = new FixedClock(T0);
  const checker = new FakeDefinitionChecker();
  const workflows = new StoredWorkflowRepository();
  const versions = new StoredWorkflowVersionRepository(workflows);
  const check = new CheckDefinition(checker, workflows, versions, clock);
  const transactions = directTransactions();
  const publish = new PublishVersion(check, workflows, versions, transactions);
  const archive = new ArchiveWorkflow(workflows, clock);
  return { clock, checker, workflows, versions, check, publish, archive };
}

type Fixture = ReturnType<typeof setUp>;

async function publishOf(fixture: Fixture, version: string) {
  const document = aDocument({ version });
  return fixture.publish.execute({ document, publisherId: 'author-1' });
}

async function currentOf(fixture: Fixture): Promise<string | null> {
  const workflow = await fixture.workflows.findByName(name);
  return workflow?.currentVersionId ?? null;
}

describe('checking a definition', () => {
  it('a_new_version_of_a_stored_workflow_is_answered_and_nothing_is_written', async () => {
    const fixture = setUp();
    await publishOf(fixture, '1.0.0');
    const currentBefore = await currentOf(fixture);
    const savesBefore = fixture.workflows.saves;

    const result = await fixture.check.execute({
      document: aDocument({ version: '2.0.0' }),
      publisherId: 'author-1',
    });

    expect(result.ok && result.value.publication.created).toBe(true);
    expect(result.ok && result.value.publication.version.semver).toBe('2.0.0');
    expect(await currentOf(fixture)).toBe(currentBefore);
    expect(fixture.workflows.saves).toBe(savesBefore);
    expect(fixture.versions.versions.size).toBe(1);
  });

  it('a_repeat_is_answered_with_the_published_version', async () => {
    const fixture = setUp();
    const first = await publishOf(fixture, '1.0.0');
    const firstId = first.ok ? first.value.publication.version.id : null;

    const result = await fixture.check.execute({
      document: aDocument(),
      publisherId: 'author-2',
    });

    expect(result.ok && result.value.publication.created).toBe(false);
    expect(result.ok && result.value.publication.version.id).toBe(firstId);
  });

  it('other_content_under_a_published_version_is_answered_as_taken', async () => {
    const fixture = setUp();
    await publishOf(fixture, '1.0.0');

    const result = await fixture.check.execute({
      document: aDocument({}, changedTasks),
      publisherId: 'author-1',
    });

    expect(result).toEqual({
      ok: false,
      failure: WorkflowRefusal.VersionTaken,
    });
  });

  it('a_new_version_of_an_archived_workflow_is_answered_as_archived', async () => {
    const fixture = setUp();
    await publishOf(fixture, '1.0.0');
    await fixture.archive.execute({ name });

    const result = await fixture.check.execute({
      document: aDocument({ version: '2.0.0' }),
      publisherId: 'author-1',
    });

    expect(result).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
  });

  it('a_refused_document_is_answered_with_its_problem', async () => {
    const fixture = setUp();
    const problem = { pointer: '/do', detail: 'empty' };
    fixture.checker.refused.set('route-lead', problem);

    const result = await fixture.check.execute({
      document: aDocument(),
      publisherId: 'author-1',
    });

    expect(result).toEqual({ ok: false, failure: problem });
  });
});

describe('publishing versions', () => {
  it('the_version_carries_its_publisher_and_the_clock', async () => {
    const fixture = setUp();

    const result = await publishOf(fixture, '1.0.0');

    const version = result.ok ? result.value.publication.version : null;
    expect(version?.publisherId).toBe('author-1');
    expect(version?.publishedAt).toBe(T0);
    expect(version?.semver).toBe('1.0.0');
    expect(version?.dsl).toBe('1.0.3');
    expect(result.ok && result.value.workflow.name.equals(name)).toBe(true);
  });

  it('each_new_version_becomes_current', async () => {
    const fixture = setUp();

    const first = await publishOf(fixture, '1.0.0');
    const afterFirst = await currentOf(fixture);
    const second = await publishOf(fixture, '2.0.0');

    expect(afterFirst).toBe(first.ok && first.value.publication.version.id);
    expect(await currentOf(fixture)).toBe(
      second.ok && second.value.publication.version.id,
    );
    expect(fixture.versions.versions.size).toBe(2);
  });

  it('a_lower_version_published_later_becomes_current', async () => {
    const fixture = setUp();
    await publishOf(fixture, '2.0.0');

    const lower = await publishOf(fixture, '1.0.0');

    expect(await currentOf(fixture)).toBe(
      lower.ok && lower.value.publication.version.id,
    );
  });

  it('a_repeat_of_an_older_version_leaves_the_current_one', async () => {
    const fixture = setUp();
    await publishOf(fixture, '1.0.0');
    const second = await publishOf(fixture, '2.0.0');

    const repeat = await publishOf(fixture, '1.0.0');

    expect(repeat.ok && repeat.value.publication.created).toBe(false);
    expect(await currentOf(fixture)).toBe(
      second.ok && second.value.publication.version.id,
    );
    expect(fixture.versions.adds).toBe(2);
  });

  // DEFECT (low): US1 AS3 says a repeat changes nothing, yet publish-version.ts:26 saves the
  // workflow again (its lock version moves), so two concurrent repeats of the same document
  // make one of them a StaleWriteError (409) instead of the existing version.
  it('a_repeat_writes_nothing', async () => {
    const fixture = setUp();
    await publishOf(fixture, '1.0.0');
    const savesBefore = fixture.workflows.saves;

    await publishOf(fixture, '1.0.0');

    expect(fixture.workflows.saves).toBe(savesBefore);
  });

  it('other_content_under_a_published_version_writes_nothing', async () => {
    const fixture = setUp();
    const first = await publishOf(fixture, '1.0.0');
    const savesBefore = fixture.workflows.saves;

    const result = await fixture.publish.execute({
      document: aDocument({}, changedTasks),
      publisherId: 'author-1',
    });

    expect(result).toEqual({
      ok: false,
      failure: WorkflowRefusal.VersionTaken,
    });
    expect(fixture.workflows.saves).toBe(savesBefore);
    expect(fixture.versions.adds).toBe(1);
    expect(await currentOf(fixture)).toBe(
      first.ok && first.value.publication.version.id,
    );
  });

  it('the_same_version_of_another_workflow_is_not_taken', async () => {
    const fixture = setUp();
    await publishOf(fixture, '1.0.0');

    const other = await fixture.publish.execute({
      document: aDocument({ name: 'other' }),
      publisherId: 'author-1',
    });

    expect(other.ok && other.value.publication.created).toBe(true);
    expect(fixture.workflows.rows.size).toBe(2);
  });

  it('a_refused_document_writes_nothing', async () => {
    const fixture = setUp();
    fixture.checker.refused.set('route-lead', { pointer: '', detail: 'x' });

    await publishOf(fixture, '1.0.0');

    expect(fixture.workflows.saves).toBe(0);
    expect(fixture.versions.adds).toBe(0);
  });
});

describe('publishing and archiving together', () => {
  it('archiving_keeps_the_current_version_and_the_first_moment', async () => {
    const fixture = setUp();
    await publishOf(fixture, '1.0.0');
    const current = await currentOf(fixture);

    const first = await fixture.archive.execute({ name });
    fixture.clock.current = later;
    const second = await fixture.archive.execute({ name });

    const workflow = await fixture.workflows.findByName(name);
    expect(first).toEqual({ ok: true, value: undefined });
    expect(second).toEqual({ ok: true, value: undefined });
    expect(workflow?.status).toBe(WorkflowStatus.Archived);
    expect(workflow?.archivedAt).toBe(T0);
    expect(workflow?.currentVersionId).toBe(current);
  });

  it('an_archived_workflow_answers_a_repeat_of_the_same_document', async () => {
    const fixture = setUp();
    const first = await publishOf(fixture, '1.0.0');
    await fixture.archive.execute({ name });

    const repeat = await publishOf(fixture, '1.0.0');

    expect(repeat.ok && repeat.value.publication.created).toBe(false);
    expect(repeat.ok && repeat.value.publication.version.id).toBe(
      first.ok && first.value.publication.version.id,
    );
    const workflow = await fixture.workflows.findByName(name);
    expect(workflow?.status).toBe(WorkflowStatus.Archived);
    expect(fixture.versions.adds).toBe(1);
  });

  it('an_archived_workflow_refuses_a_new_version_and_stores_nothing', async () => {
    const fixture = setUp();
    const first = await publishOf(fixture, '1.0.0');
    await fixture.archive.execute({ name });
    const savesBefore = fixture.workflows.saves;

    const next = await publishOf(fixture, '2.0.0');

    expect(next).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
    expect(fixture.workflows.saves).toBe(savesBefore);
    expect(fixture.versions.adds).toBe(1);
    expect(await currentOf(fixture)).toBe(
      first.ok && first.value.publication.version.id,
    );
  });

  it('an_archived_workflow_answers_other_content_under_a_published_version_as_taken', async () => {
    const fixture = setUp();
    await publishOf(fixture, '1.0.0');
    await fixture.archive.execute({ name });

    const result = await fixture.publish.execute({
      document: aDocument({}, changedTasks),
      publisherId: 'author-1',
    });

    expect(result).toEqual({
      ok: false,
      failure: WorkflowRefusal.VersionTaken,
    });
  });

  it('an_unknown_workflow_is_not_archived_and_nothing_is_written', async () => {
    const fixture = setUp();

    const result = await fixture.archive.execute({ name });

    expect(result).toEqual({ ok: false, failure: Missing.Workflow });
    expect(fixture.workflows.saves).toBe(0);
  });
});
