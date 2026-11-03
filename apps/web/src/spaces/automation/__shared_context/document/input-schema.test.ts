import { describe, expect, it } from 'vitest';
import type { JsonObject } from '@/libs/data-access/types';
import { inputFieldsOf, inputFrom } from './input-schema';

const withSchema = (document: JsonObject): JsonObject => ({
  input: { schema: { format: 'json', document } },
  do: [],
});

describe('the input form of a workflow', () => {
  it('a_flat_object_of_plain_values_becomes_fields', () => {
    const fields = inputFieldsOf(
      withSchema({
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string' },
          score: { type: 'integer' },
          vip: { type: 'boolean' },
        },
      }),
    );

    expect(
      fields?.map((field) => [field.name, field.type, field.required]),
    ).toEqual([
      ['email', 'string', true],
      ['score', 'integer', false],
      ['vip', 'boolean', false],
    ]);
  });

  it('any_other_schema_is_given_as_json', () => {
    expect(
      inputFieldsOf(
        withSchema({ type: 'object', properties: { tags: { type: 'array' } } }),
      ),
    ).toBeNull();
    expect(inputFieldsOf({ do: [] })).toBeNull();
  });

  it('types_the_values_and_leaves_out_empty_optional_ones', () => {
    const fields = inputFieldsOf(
      withSchema({
        type: 'object',
        properties: {
          email: { type: 'string' },
          score: { type: 'number' },
          vip: { type: 'boolean' },
        },
      }),
    );

    expect(
      inputFrom(fields ?? [], { email: 'a@b.c', score: '', vip: 'true' }),
    ).toEqual({ email: 'a@b.c', vip: true });
  });
});
