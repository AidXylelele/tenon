import type { JsonValue, Manifest } from "../../api/index.js";
import type { CompiledExpression, Validator } from "../../runtime/index.js";
import type { Procedure, Stream, Term } from "./terms.js";
import type { SchemaTerm } from "./values.js";

export interface Program {
  readonly root: Term;
  readonly input: SchemaTerm | null;
  readonly procedures: ReadonlyMap<string, Procedure>;
  readonly triggers: readonly Stream[];
  readonly expressions: ReadonlyMap<string, CompiledExpression>;
  readonly schemas: ReadonlyMap<string, Validator>;
  readonly patterns: ReadonlyMap<string, RegExp>;
  readonly definition: JsonValue;
  readonly manifest: Manifest;
  readonly fingerprint: string;
}
