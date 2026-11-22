import { type Jq, JqError } from "jq-wasm";
import type { JsonValue } from "../../api/index.js";
import { defaults } from "../../standard/index.js";
import { CompiledPrograms } from "./compiled-programs.js";
import {
  beyondDoubles,
  isTooDeepForEngine,
  isWithinDoubles,
  tooDeepForEngine,
} from "./engine-limits.js";
import { EngineMemory } from "./engine-memory.js";
import { dateParsing, sandbox } from "./sandbox.js";
import type {
  Evaluated,
  Evaluation,
  ExpressionCompilation,
  ExpressionForm,
  ExpressionLanguage,
  WasmMemory,
} from "./types.js";
import {
  checkDeclaredNames,
  memberNamesOf,
  variablesOf,
} from "./variable-names.js";
import { wasmRuntime } from "./wasm-runtime.js";

const programForm: ExpressionForm = Object.freeze({ kind: "program" });
const compileErrorPrefix = "jq: error: ";
const unknownVariable = /^\$(\S+) is not defined\b/;
const runErrorPrefix = /^jq: error \(at [^)]*\)(?:: )?/;
const location = / at <top-level>, line (\d+), (column \d+):$/;
const aborted = "The expression engine aborted the evaluation";
const flags = ["--"];
const dateParsers = /strptime|fromdate/;
const keptPrograms = 4096;

export class JqLanguage implements ExpressionLanguage {
  readonly #jq: Jq;
  readonly #memory: EngineMemory;
  readonly #compiled = new CompiledPrograms(keptPrograms);

  constructor(jq: Jq, memory: WasmMemory) {
    jq.raw("", ".", flags);

    this.#jq = jq;
    this.#memory = new EngineMemory(memory);
  }

  get name(): string {
    return defaults.expressionLanguage;
  }

  variablesOf(source: string): readonly string[] {
    return variablesOf(source);
  }

  memberNamesOf(source: string, variable: string): readonly string[] {
    return memberNamesOf(source, variable);
  }

  compile(source: string, names: readonly string[]): ExpressionCompilation {
    checkDeclaredNames(names);

    const program = this.#programOf(source, names, 0);

    // A jq-wasm trap depends on the engine's state, not on the program:
    // it is never kept, and the engine's memory is restored.
    try {
      return this.#compiled.compilationOf(program, () =>
        this.#engineCompilationOf(source, names, program),
      );
    } catch (error) {
      const isAbort = this.#isAbort(error);

      if (!isAbort) {
        throw error;
      }

      this.#memory.restore();
      return { kind: "invalid", message: `${aborted}.` };
    }
  }

  evaluate(evaluation: Evaluation): Evaluated {
    const tooDeep = this.#isTooDeep(evaluation);

    if (tooDeep) {
      return { kind: "failed", message: tooDeepForEngine };
    }

    return this.#run(evaluation);
  }

  #programOf(
    source: string,
    names: readonly string[],
    seconds: number,
  ): string {
    const pattern = names.map((name) => `$${name}`).join(", ");
    const bindings = names.length === 0 ? "" : `.arguments as {${pattern}} |`;
    const parsesDates = dateParsers.test(source);
    const dates = parsesDates ? dateParsing : "";

    return `def now: ${String(seconds)}; ${dates} ${sandbox} ${bindings} .input |\n${source}`;
  }

  #engineCompilationOf(
    source: string,
    names: readonly string[],
    program: string,
  ): ExpressionCompilation {
    const report = this.#jq.raw("", program, flags);

    if (report.exitCode !== 0) {
      return this.#compileFailureOf(report.stderr);
    }

    const ownNames = [...names];
    const expression = { source, names: ownNames, form: programForm };
    return { kind: "compiled", expression };
  }

  #isAbort(error: unknown): error is Error {
    return error instanceof wasmRuntime.RuntimeError;
  }

  #compileFailureOf(stderr: string): ExpressionCompilation {
    const errors = stderr
      .split("\n")
      .filter((line) => line.startsWith(compileErrorPrefix))
      .map((line) => line.slice(compileErrorPrefix.length));
    const variable = this.#unknownVariableOf(errors);

    if (variable !== null) {
      return { kind: "unknown-variable", variable };
    }

    const message = this.#invalidMessageOf(errors, stderr);
    return { kind: "invalid", message };
  }

  #unknownVariableOf(errors: readonly string[]): string | null {
    const [first = ""] = errors;
    return unknownVariable.exec(first)?.[1] ?? null;
  }

  #invalidMessageOf(errors: readonly string[], stderr: string): string {
    if (errors.length === 0) {
      return stderr;
    }

    const messages = errors.map((error) => this.#sourceErrorOf(error));
    return messages.join("; ");
  }

  #sourceErrorOf(error: string): string {
    return error.replace(location, (_found, row: string, column: string) =>
      this.#sourceLocationOf(row, column),
    );
  }

  #sourceLocationOf(row: string, column: string): string {
    const sourceRow = Number(row) - 1;
    return ` at line ${String(sourceRow)}, ${column}`;
  }

  #isTooDeep(evaluation: Evaluation): boolean {
    const inputTooDeep = isTooDeepForEngine(evaluation.input);
    const values = Object.values(evaluation.arguments);
    const argumentTooDeep = values.some((value) => isTooDeepForEngine(value));

    return inputTooDeep || argumentTooDeep;
  }

  #run(evaluation: Evaluation): Evaluated {
    const { source, names } = evaluation.expression;
    const seconds = evaluation.now / 1000;
    const program = this.#programOf(source, names, seconds);
    const envelope = JSON.stringify({
      input: evaluation.input,
      arguments: evaluation.arguments,
    });

    try {
      const values = this.#jq.json<JsonValue>(envelope, program, flags);
      return this.#evaluatedOf(values);
    } catch (error) {
      const message = this.#failureOf(error);
      return { kind: "failed", message };
    }
  }

  #evaluatedOf(values: readonly JsonValue[]): Evaluated {
    const withinDoubles = values.every((value) => isWithinDoubles(value));

    if (!withinDoubles) {
      return { kind: "failed", message: beyondDoubles };
    }

    const value = this.#streamValueOf(values);
    return { kind: "value", value };
  }

  #streamValueOf(values: readonly JsonValue[]): JsonValue {
    const [single] = values;

    if (values.length > 1) {
      return values;
    }

    return single ?? null;
  }

  #failureOf(error: unknown): string {
    if (error instanceof JqError) {
      return error.stderr.trim().replace(runErrorPrefix, "");
    }

    const isAbort = this.#isAbort(error);

    if (!isAbort) {
      throw error;
    }

    this.#memory.restore();
    return `${aborted}: ${error.message}`;
  }
}
