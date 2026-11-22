import { jqLanguageOf, JsonSchemas } from "./runtime/index.js";
import { Analyzer } from "./semantics/index.js";
import { GrammarCheck } from "./syntax/index.js";

export type {
  Diagnostic,
  HostProfile,
  Imports,
  JsonArray,
  JsonObject,
  JsonValue,
  Position,
  Range,
} from "./api/index.js";
export { resolutionsOf } from "./semantics/index.js";
export type {
  Analysis,
  Analyzer,
  BinderBinding,
  Binding,
  ComponentTable,
  ExpressionResolution,
  Occurrence,
  SemanticModel,
} from "./semantics/index.js";
export {
  flowDirectives,
  runtimeArguments,
  standardVersion,
  taskKinds,
} from "./standard/index.js";
export type { TaskKind } from "./standard/index.js";
export type * as ast from "./syntax/ast/index.js";
export type {
  PointerAt,
  RangeLocator,
  SchemaAt,
  SchemaMember,
  SourceDocument,
} from "./syntax/index.js";

export async function createAnalyzer(engine: Uint8Array): Promise<Analyzer> {
  const expressions = await jqLanguageOf(engine);
  const grammar = GrammarCheck.standard();
  const schemas = new JsonSchemas([]);

  return new Analyzer(expressions, grammar, schemas);
}
