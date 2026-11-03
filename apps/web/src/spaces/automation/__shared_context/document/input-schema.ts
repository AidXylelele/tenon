import type { JsonObject, JsonValue } from '@/libs/data-access/types';
import { isObject } from './json';

// The fields of a workflow's input when its schema is a flat object of plain values, so a
// start can offer a form; any other schema is given as JSON (spec, Assumptions).

export type InputFieldType = 'string' | 'number' | 'integer' | 'boolean';

export interface InputField {
  readonly name: string;
  readonly type: InputFieldType;
  readonly required: boolean;
  readonly description: string;
  readonly fallback: JsonValue | undefined;
}

const TYPES: readonly InputFieldType[] = [
  'string',
  'number',
  'integer',
  'boolean',
];

export function inputFieldsOf(
  document: JsonObject | null,
): InputField[] | null {
  const schema = schemaOf(document);

  if (
    schema === null ||
    schema.type !== 'object' ||
    !isObject(schema.properties)
  )
    return null;

  const required = Array.isArray(schema.required) ? schema.required : [];
  const fields: InputField[] = [];

  for (const [name, property] of Object.entries(schema.properties)) {
    if (!isObject(property)) return null;

    const type = TYPES.find((each) => each === property.type);

    if (type === undefined) return null;

    fields.push({
      name,
      type,
      required: required.includes(name),
      description:
        typeof property.description === 'string' ? property.description : '',
      fallback: property.default,
    });
  }

  return fields;
}

// The input a form gives, typed as its schema says; an empty optional field is left out.
export function inputFrom(
  fields: readonly InputField[],
  values: Record<string, string>,
): JsonObject {
  const input: JsonObject = {};

  for (const field of fields) {
    const text = values[field.name] ?? '';

    if (text === '' && field.type !== 'boolean') continue;

    input[field.name] = valueOf(field.type, text);
  }

  return input;
}

function valueOf(type: InputFieldType, text: string): JsonValue {
  if (type === 'boolean') return text === 'true';

  if (type === 'string') return text;

  const number = Number(text);
  return Number.isFinite(number) ? number : text;
}

function schemaOf(document: JsonObject | null): JsonObject | null {
  const input = document?.input;

  if (!isObject(input) || !isObject(input.schema)) return null;

  const schema = input.schema;
  return isObject(schema.document) ? schema.document : null;
}
