import { CheckDocument } from '../../../../../src/application/automation/workflows/check-document.js';
import { PublishVersion } from '../../../../../src/application/automation/workflows/publish-version.js';
import { DocumentFormat } from '../../../../../src/domain/automation/workflows/enums.js';
import {
  DefinitionRejectedError,
  VersionConflictError,
} from '../../../../../src/domain/errors.js';
import {
  FakeExpressionEvaluator,
  InMemoryWorkflowRepository,
  InMemoryWorkflowVersionRepository,
  JsonDefinitionReader,
} from '../../../../support/fakes.js';
import {
  AcceptingSchemaValidator,
  FixedClock,
} from '../../../../support/instance-fakes.js';

function documentText(version: string, greeting: string): string {
  return JSON.stringify({
    document: { dsl: '1.0.3', namespace: 'default', name: 'greet', version },
    do: [{ hello: { set: { greeting } } }],
  });
}

function setUp() {
  const workflows = new InMemoryWorkflowRepository();
  const versions = new InMemoryWorkflowVersionRepository(workflows);
  const check = new CheckDocument(
    new JsonDefinitionReader(),
    new FakeExpressionEvaluator(),
    new AcceptingSchemaValidator(),
  );
  const clock = new FixedClock(new Date('2026-11-01T10:00:00.000Z'));
  const publish = new PublishVersion(check, workflows, versions, clock);
  return { workflows, versions, publish };
}

describe('PublishVersion', () => {
  it('a_first_version_registers_the_workflow_and_becomes_current', async () => {
    const { workflows, versions, publish } = setUp();

    const result = await publish.execute({
      format: DocumentFormat.Json,
      text: documentText('1.0.0', 'hi'),
      publisherId: 'author-1',
    });

    const [workflow] = [...workflows.workflows.values()];
    expect(result.created).toBe(true);
    expect(result.version.semver).toBe('1.0.0');
    expect(result.version.publisherId).toBe('author-1');
    expect(workflow?.currentVersionId).toBe(result.version.id);
    expect(versions.versions).toHaveLength(1);
  });

  it('the_identical_document_again_returns_the_existing_version_and_changes_nothing', async () => {
    const { versions, publish } = setUp();
    const text = documentText('1.0.0', 'hi');
    const first = await publish.execute({
      format: DocumentFormat.Json,
      text,
      publisherId: 'author-1',
    });

    const again = await publish.execute({
      format: DocumentFormat.Json,
      text,
      publisherId: 'author-2',
    });

    expect(again.created).toBe(false);
    expect(again.version.id).toBe(first.version.id);
    expect(versions.versions).toHaveLength(1);
  });

  it('an_older_version_published_again_is_returned_as_not_current', async () => {
    const { publish } = setUp();
    const first = documentText('1.0.0', 'hi');
    await publish.execute({
      format: DocumentFormat.Json,
      text: first,
      publisherId: 'author-1',
    });
    await publish.execute({
      format: DocumentFormat.Json,
      text: documentText('1.1.0', 'hello'),
      publisherId: 'author-1',
    });

    const again = await publish.execute({
      format: DocumentFormat.Json,
      text: first,
      publisherId: 'author-1',
    });

    expect(again.created).toBe(false);
    expect(again.current).toBe(false);
  });

  it('other_content_under_the_same_version_is_a_conflict', async () => {
    const { publish } = setUp();
    await publish.execute({
      format: DocumentFormat.Json,
      text: documentText('1.0.0', 'hi'),
      publisherId: 'author-1',
    });

    const conflicting = publish.execute({
      format: DocumentFormat.Json,
      text: documentText('1.0.0', 'hello'),
      publisherId: 'author-1',
    });

    await expect(conflicting).rejects.toThrow(VersionConflictError);
  });

  it('a_later_version_becomes_current', async () => {
    const { workflows, publish } = setUp();
    await publish.execute({
      format: DocumentFormat.Json,
      text: documentText('1.0.0', 'hi'),
      publisherId: 'author-1',
    });

    const second = await publish.execute({
      format: DocumentFormat.Json,
      text: documentText('1.1.0', 'hello'),
      publisherId: 'author-1',
    });

    const [workflow] = [...workflows.workflows.values()];
    expect(workflows.workflows.size).toBe(1);
    expect(workflow?.currentVersionId).toBe(second.version.id);
  });

  it('a_refused_document_stores_nothing', async () => {
    const { workflows, versions, publish } = setUp();
    const text = JSON.stringify({
      document: {
        dsl: '1.0.3',
        namespace: 'default',
        name: 'greet',
        version: '1.0.0',
      },
      do: [{ pause: { wait: 'PT1S' } }],
    });

    const refused = publish.execute({
      format: DocumentFormat.Json,
      text,
      publisherId: 'author-1',
    });

    await expect(refused).rejects.toThrow(DefinitionRejectedError);
    expect(workflows.workflows.size).toBe(0);
    expect(versions.versions).toHaveLength(0);
  });
});
