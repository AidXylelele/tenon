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

// Checking the schema or the value outlasted its time limit.
export interface JsonSchemaTimedOut {
  readonly kind: JsonSchemaOutcomeKind.TimedOut;
}

export type JsonSchemaCompilation =
  JsonSchemaCompiled | JsonSchemaUnusable | JsonSchemaTimedOut;

export type JsonSchemaVerdict =
  JsonSchemaValid | JsonSchemaInvalid | JsonSchemaUnusable | JsonSchemaTimedOut;

export abstract class JsonSchemaClient {
  abstract compile(schema: JsonObject): Promise<JsonSchemaCompilation>;
  abstract validate(
    schema: JsonObject,
    data: JsonValue,
  ): Promise<JsonSchemaVerdict>;
}
