import { ErrorType } from '../../../src/domain/automation/language/error-type.js';
import { JsonPointer } from '../../../src/domain/automation/language/json-pointer.js';
import { createJsonSchemaCompilers } from '../../../src/frameworks/ajv/json-schema-compilers.js';
import { AjvSchemaValidator } from '../../../src/interface-adapters/json-schema/ajv-schema.validator.js';

describe('AjvSchemaValidator', () => {
  const validator = new AjvSchemaValidator(createJsonSchemaCompilers());
  const at = JsonPointer.root().at('input').at('schema');
  const order = {
    type: 'object',
    required: ['orderId'],
    properties: { orderId: { type: 'string', format: 'uuid' } },
  };

  it('a_value_that_matches_its_schema_is_validated', async () => {
    const [result] = await validator.validateAll([
      {
        id: 'w:1',
        schema: order,
        data: { orderId: 'a6a2c7b4-6f0e-4d39-9a4b-6f1b8f4b0001' },
      },
    ]);

    expect(result?.id).toBe('w:1');
    expect(result?.failure(at)).toBeNull();
  });

  it('a_value_that_breaks_its_schema_fails_with_a_validation_error_and_its_reason', async () => {
    const [missing, malformed] = await validator.validateAll([
      { id: 'w:1', schema: order, data: {} },
      { id: 'w:2', schema: order, data: { orderId: 'not-a-uuid' } },
    ]);
    const validation = ErrorType.Validation.errorAt(at, null);

    expect(missing?.failure(at)?.type).toBe(validation.type);
    expect(missing?.failure(at)?.detail).toContain('orderId');
    expect(malformed?.failure(at)?.detail).toContain('uuid');
  });

  it('a_schema_declaring_draft_2020_12_is_validated_by_that_dialect', async () => {
    const tuple = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'array',
      prefixItems: [{ type: 'number' }],
      items: false,
    };

    const [result] = await validator.validateAll([
      { id: 'w:1', schema: tuple, data: [1, 2] },
    ]);

    expect(result?.failure(at)).not.toBeNull();
  });

  it('a_schema_that_is_not_a_json_schema_fails_the_validation', async () => {
    const [result] = await validator.validateAll([
      { id: 'w:1', schema: { type: 'objekt' }, data: {} },
    ]);

    expect(result?.failure(at)?.detail).toBe(
      'The schema is not a valid JSON Schema',
    );
  });
});
