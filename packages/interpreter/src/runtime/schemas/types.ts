import type { JsonObject, JsonValue } from "../../api/index.js";

export interface SchemaViolation {
  readonly pointer: string;
  readonly instance: string;
  readonly keyword: string;
  readonly message: string;
  readonly subject: string;
  readonly value: JsonValue;
  readonly pattern: string | null;
  readonly location: string | null;
  readonly ambiguous: boolean;
  readonly branches: readonly SchemaBranch[];
}

export interface SchemaBranch {
  readonly schema: JsonValue;
  readonly violations: readonly SchemaViolation[];
}

export interface SchemaLocation {
  readonly uri: string;
  readonly node: JsonObject;
}

export type Validator = (value: JsonValue) => readonly SchemaViolation[];

export type SchemaCompilation =
  | { readonly kind: "compiled"; readonly validator: Validator }
  | { readonly kind: "invalid"; readonly message: string };

export interface SchemaCompiler {
  compile(schema: JsonValue): SchemaCompilation;
}

export interface SchemaReferences {
  validatorOf(reference: string): Validator;
}
