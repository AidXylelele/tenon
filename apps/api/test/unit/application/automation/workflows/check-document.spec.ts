import { CheckDocument } from '../../../../../src/application/automation/workflows/check-document.js';
import { PublishVersion } from '../../../../../src/application/automation/workflows/publish-version.js';
import { DocumentFormat } from '../../../../../src/domain/automation/workflows/enums.js';
import {
  type DefinitionRejectedError,
  VersionConflictError,
  InvalidDocumentError,
  InvalidExpressionError,
  UnsupportedConstructError,
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

function documentText(tasks: readonly object[]): string {
  return JSON.stringify({
    document: {
      dsl: '1.0.3',
      namespace: 'default',
      name: 'greet',
      version: '1.0.0',
    },
    do: tasks,
  });
}

const versions = new InMemoryWorkflowVersionRepository(
  new InMemoryWorkflowRepository(),
);

function checker(refused: ReadonlySet<string> = new Set()): CheckDocument {
  const definitions = new JsonDefinitionReader();
  const expressions = new FakeExpressionEvaluator(refused);
  const schemas = new AcceptingSchemaValidator();
  return new CheckDocument(definitions, expressions, schemas, versions);
}

function json(text: string) {
  return { format: DocumentFormat.Json, text };
}

async function rejectionOf(
  check: Promise<unknown>,
): Promise<DefinitionRejectedError> {
  try {
    await check;
  } catch (error) {
    return error as DefinitionRejectedError;
  }

  throw new Error('The document was not rejected');
}

describe('CheckDocument', () => {
  it('a_valid_document_gives_its_definition', async () => {
    const text = documentText([{ hello: { set: { greeting: '${ .name }' } } }]);

    const checked = await checker().execute(json(text));

    expect(checked.definition.workflow.toString()).toBe('default/greet');
    expect(checked.definition.version).toBe('1.0.0');
    expect(checked.existing).toBeNull();
  });

  it('a_construct_outside_the_subset_is_refused_before_any_expression', async () => {
    const text = documentText([
      { pause: { wait: 'PT1S' } },
      { compute: { set: { value: '${ .a + }' } } },
    ]);
    const refused = new Set(['.a +']);

    const rejection = await rejectionOf(checker(refused).execute(json(text)));

    expect(rejection).toBeInstanceOf(UnsupportedConstructError);
    expect(rejection.pointer).toBe('/do/0/pause/wait');
  });

  it('an_invalid_expression_is_refused_where_it_stands', async () => {
    const text = documentText([{ compute: { set: { value: '${ .a + }' } } }]);
    const refused = new Set(['.a +']);

    const rejection = await rejectionOf(checker(refused).execute(json(text)));

    expect(rejection).toBeInstanceOf(InvalidExpressionError);
    expect(rejection.pointer).toBe('/do/0/compute/set/value');
  });

  it('an_unreadable_document_is_refused', async () => {
    const rejection = await rejectionOf(checker().execute(json('not json')));

    expect(rejection).toBeInstanceOf(InvalidDocumentError);
    expect(rejection.message).toBe('The document is not JSON');
  });

  it('other_content_under_a_published_version_is_refused_as_publishing_would', async () => {
    const workflows = new InMemoryWorkflowRepository();
    const published = new InMemoryWorkflowVersionRepository(workflows);
    const check = new CheckDocument(
      new JsonDefinitionReader(),
      new FakeExpressionEvaluator(),
      new AcceptingSchemaValidator(),
      published,
    );
    const clock = new FixedClock(new Date('2026-11-01T10:00:00.000Z'));
    const publish = new PublishVersion(check, workflows, published, clock);
    const first = documentText([{ hello: { set: { greeting: 'hi' } } }]);
    const other = documentText([{ hello: { set: { greeting: 'bye' } } }]);
    await publish.execute({ ...json(first), publisherId: 'author-1' });

    const same = await check.execute(json(first));
    const conflicting = check.execute(json(other));

    expect(same.existing).not.toBeNull();
    await expect(conflicting).rejects.toThrow(VersionConflictError);
  });
});
