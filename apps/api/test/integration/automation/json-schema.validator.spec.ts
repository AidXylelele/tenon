import { ErrorType } from '../../../src/domain/automation/language/error-type.js';
import { JsonPointer } from '../../../src/domain/automation/language/json-pointer.js';
import { Schema } from '../../../src/domain/automation/language/schema.js';
import { InvalidSchemaError } from '../../../src/domain/errors.js';
import { AjvJsonSchemaClient } from '../../../src/frameworks/ajv/ajv-json-schema.client.js';
import { JsonSchemaValidator } from '../../../src/interface-adapters/workflows/schemas/json-schema.validator.js';

describe('JsonSchemaValidator', () => {
  const validator = new JsonSchemaValidator(new AjvJsonSchemaClient());
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

  it('a_schema_that_is_not_a_json_schema_is_a_configuration_error', async () => {
    const [result] = await validator.validateAll([
      { id: 'w:1', schema: { type: 'objekt' }, data: {} },
    ]);

    expect(result?.failure(at)).toMatchObject({
      type: 'https://serverlessworkflow.io/spec/1.0.0/errors/configuration',
      status: 400,
      detail: 'The schema is not a valid JSON Schema',
    });
  });

  it('a_schema_with_an_id_validates_every_time_it_is_used', async () => {
    const identified = {
      $id: 'https://schemas.example/order',
      type: 'object',
      required: ['orderId'],
    };

    const [first] = await validator.validateAll([
      { id: 'w:1', schema: identified, data: { orderId: '1' } },
    ]);
    const [second] = await validator.validateAll([
      { id: 'w:2', schema: identified, data: {} },
    ]);

    expect(first?.failure(at)).toBeNull();
    expect(second?.failure(at)?.detail).toContain('orderId');
  });

  it('the_compiled_schemas_ajv_keeps_stay_bounded', async () => {
    const client = new AjvJsonSchemaClient();
    const bounded = new JsonSchemaValidator(client);
    const validations = Array.from({ length: 400 }, (_, index) => ({
      id: `w:${String(index)}`,
      schema: { type: 'object', minProperties: index },
      data: {},
    }));

    await bounded.validateAll(validations);

    const draft07: unknown = Reflect.get(client, 'draft07');
    const cache: unknown = Reflect.get(draft07 as object, '_cache');
    expect((cache as Map<unknown, unknown>).size).toBeLessThanOrEqual(260);
  });

  it('a_usable_schema_passes_the_publish_check', async () => {
    const schema = new Schema({ pointer: at, document: order });

    await expect(validator.check([schema])).resolves.toBeUndefined();
  });

  it('an_unusable_schema_is_refused_at_publish_where_it_stands', async () => {
    const usable = new Schema({ pointer: at, document: order });
    const outputAt = JsonPointer.root().at('output').at('schema');
    const unusable = new Schema({
      pointer: outputAt,
      document: { type: 'nonsense' },
    });

    const check = validator.check([usable, unusable]);

    await expect(check).rejects.toThrow(InvalidSchemaError);
    await expect(check).rejects.toMatchObject({ pointer: '/output/schema' });
  });
});
