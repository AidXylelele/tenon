import type {
  JsonObject,
  JsonValue,
} from '../../../domain/automation/language/interfaces.js';
import type { JsonSchemaOutcomeKind } from './enums.js';

export interface JsonSchemaCompiled {
  readonly kind: JsonSchemaOutcomeKind.Compiled;
}

export interface JsonSchemaValid {
  readonly kind: JsonSchemaOutcomeKind.Valid;
}

export interface JsonSchemaInvalid {
  readonly kind: JsonSchemaOutcomeKind.Invalid;
  readonly reason: string;
}

export interface JsonSchemaUnusable {
  readonly kind: JsonSchemaOutcomeKind.Unusable;
  readonly reason: string;
}

export type JsonSchemaCompilation = JsonSchemaCompiled | JsonSchemaUnusable;

export type JsonSchemaVerdict =
  JsonSchemaValid | JsonSchemaInvalid | JsonSchemaUnusable;

export abstract class JsonSchemaClient {
  abstract compile(schema: JsonObject): JsonSchemaCompilation;
  abstract validate(schema: JsonObject, data: JsonValue): JsonSchemaVerdict;
}
