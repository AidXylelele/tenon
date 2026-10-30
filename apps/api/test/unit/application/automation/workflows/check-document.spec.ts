import { CheckDocument } from '../../../../../src/application/automation/workflows/check-document.js';
import { DocumentFormat } from '../../../../../src/domain/automation/workflows/enums.js';
import {
  type DefinitionRejectedError,
  InvalidDocumentError,
  InvalidExpressionError,
  UnsupportedConstructError,
} from '../../../../../src/domain/errors.js';
import {
  FakeExpressionEvaluator,
  JsonDefinitionReader,
} from '../../../../support/fakes.js';

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

function checker(refused: ReadonlySet<string> = new Set()): CheckDocument {
  const definitions = new JsonDefinitionReader();
  const expressions = new FakeExpressionEvaluator(refused);
  return new CheckDocument(definitions, expressions);
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

    const definition = await checker().execute({
      format: DocumentFormat.Json,
      text,
    });

    expect(definition.workflow.toString()).toBe('default/greet');
    expect(definition.version).toBe('1.0.0');
  });

  it('a_construct_outside_the_subset_is_refused_before_any_expression', async () => {
    const text = documentText([
      { pause: { wait: 'PT1S' } },
      { compute: { set: { value: '${ .a + }' } } },
    ]);
    const refused = new Set(['.a +']);

    const rejection = await rejectionOf(
      checker(refused).execute({ format: DocumentFormat.Json, text }),
    );

    expect(rejection).toBeInstanceOf(UnsupportedConstructError);
    expect(rejection.pointer).toBe('/do/0/pause/wait');
  });

  it('an_invalid_expression_is_refused_where_it_stands', async () => {
    const text = documentText([{ compute: { set: { value: '${ .a + }' } } }]);
    const refused = new Set(['.a +']);

    const rejection = await rejectionOf(
      checker(refused).execute({ format: DocumentFormat.Json, text }),
    );

    expect(rejection).toBeInstanceOf(InvalidExpressionError);
    expect(rejection.pointer).toBe('/do/0/compute/set/value');
  });

  it('an_unreadable_document_is_refused', async () => {
    const rejection = await rejectionOf(
      checker().execute({ format: DocumentFormat.Json, text: 'not json' }),
    );

    expect(rejection).toBeInstanceOf(InvalidDocumentError);
    expect(rejection.message).toBe('The document is not JSON');
  });
});
