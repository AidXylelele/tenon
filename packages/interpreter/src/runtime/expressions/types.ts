import type { JsonObject, JsonValue } from "../../api/index.js";

export type ExpressionForm =
  | {
      readonly kind: "path";
      readonly variable: string | null;
      readonly keys: readonly string[];
    }
  | { readonly kind: "constant"; readonly value: JsonValue }
  | { readonly kind: "program" };

export interface CompiledExpression {
  readonly source: string;
  readonly names: readonly string[];
  readonly form: ExpressionForm;
}

export type ExpressionCompilation =
  | { readonly kind: "compiled"; readonly expression: CompiledExpression }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "unknown-variable"; readonly variable: string };

export interface Evaluation {
  readonly expression: CompiledExpression;
  readonly input: JsonValue;
  readonly arguments: JsonObject;
  readonly now: number;
}

export type Evaluated =
  | { readonly kind: "value"; readonly value: JsonValue }
  | { readonly kind: "failed"; readonly message: string };

export interface ExpressionLanguage {
  readonly name: string;
  variablesOf(source: string): readonly string[];
  memberNamesOf(source: string, variable: string): readonly string[];
  compile(source: string, names: readonly string[]): ExpressionCompilation;
  evaluate(evaluation: Evaluation): Evaluated;
}

export interface WasmMemory {
  readonly buffer: ArrayBuffer;
}

export interface WasmInstance {
  readonly exports: Readonly<Record<string, unknown>>;
}

export interface WasmRuntime {
  compile(binary: Uint8Array): Promise<object>;
  instantiate(module: object, imports: object): Promise<WasmInstance>;
  readonly Memory: abstract new (...parameters: never[]) => WasmMemory;
  readonly RuntimeError: abstract new (...parameters: never[]) => Error;
}
