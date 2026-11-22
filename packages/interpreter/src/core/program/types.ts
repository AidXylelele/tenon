import type { JsonValue } from "../../api/index.js";
import type { FunctionSymbol, ReadSchema } from "../../semantics/index.js";
import type * as ast from "../../syntax/index.js";

export interface SchemaDocument {
  readonly origin: string;
  readonly document: JsonValue;
}

export type Keyed<Value> = readonly [string, Value];

export interface ProgramSource {
  readonly document: JsonValue;
  readonly imported: ReadonlyMap<string, string>;
}

export interface Sources {
  readonly document: JsonValue;
  readonly schemas: ReadonlyMap<string, ast.Schema>;
  readonly functions: ReadonlyMap<string, FunctionSymbol>;
  readonly importedSchemas: ReadonlyMap<string, ReadSchema>;
  readonly texts: ReadonlyMap<string, string>;
}
