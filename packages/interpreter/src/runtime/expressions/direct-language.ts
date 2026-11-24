import type { JsonObject, JsonValue } from "../../api/index.js";
import { isJsonObject } from "../json/index.js";
import { isKeptByEngine } from "./engine-limits.js";
import { expressionFormOf } from "./expression-form.js";
import type {
  Evaluated,
  Evaluation,
  ExpressionCompilation,
  ExpressionForm,
  ExpressionLanguage,
} from "./types.js";
import { checkDeclaredNames } from "./variable-names.js";

type Path = Extract<ExpressionForm, { readonly kind: "path" }>;

interface Read {
  readonly value: JsonValue;
}

export class DirectLanguage implements ExpressionLanguage {
  readonly #engine: ExpressionLanguage;

  constructor(engine: ExpressionLanguage) {
    this.#engine = engine;
  }

  get name(): string {
    return this.#engine.name;
  }

  variablesOf(source: string): readonly string[] {
    return this.#engine.variablesOf(source);
  }

  memberNamesOf(source: string, variable: string): readonly string[] {
    return this.#engine.memberNamesOf(source, variable);
  }

  compile(source: string, names: readonly string[]): ExpressionCompilation {
    const form = expressionFormOf(source, names);

    switch (form.kind) {
      case "constant":
      case "path":
        checkDeclaredNames(names);
        return { kind: "compiled", expression: { source, names, form } };
      case "program":
        return this.#engine.compile(source, names);
    }
  }

  evaluate(evaluation: Evaluation): Evaluated {
    const read = this.#readOf(evaluation);

    if (read === null) {
      return this.#engine.evaluate(evaluation);
    }

    return { kind: "value", value: read.value };
  }

  #readOf(evaluation: Evaluation): Read | null {
    const { form } = evaluation.expression;

    switch (form.kind) {
      case "constant":
        return { value: form.value };
      case "path":
        return this.#pathReadOf(form, evaluation);
      case "program":
        return null;
    }
  }

  #pathReadOf(path: Path, evaluation: Evaluation): Read | null {
    const root = this.#rootOf(path, evaluation);
    const read = this.#readAt(root, path.keys, 0);

    if (read === null) {
      return null;
    }

    const kept = isKeptByEngine(read.value);
    return kept ? read : null;
  }

  #rootOf(path: Path, evaluation: Evaluation): JsonValue {
    if (path.variable === null) {
      return evaluation.input;
    }

    return this.#memberOf(evaluation.arguments, path.variable);
  }

  #readAt(
    base: JsonValue,
    keys: readonly string[],
    index: number,
  ): Read | null {
    const key = keys[index];

    if (key === undefined) {
      return { value: base };
    }

    if (base === null) {
      return { value: null };
    }

    const isObject = isJsonObject(base);

    if (!isObject) {
      return null;
    }

    const member = this.#memberOf(base, key);
    const next = index + 1;

    return this.#readAt(member, keys, next);
  }

  #memberOf(object: JsonObject, key: string): JsonValue {
    const isOwn = Object.hasOwn(object, key);

    if (!isOwn) {
      return null;
    }

    return object[key] ?? null;
  }
}
