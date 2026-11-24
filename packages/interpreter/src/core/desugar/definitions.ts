import type { JsonValue } from "../../api/index.js";
import {
  InterpreterError,
  pointedValueOf,
  relativePointerOf,
} from "../../runtime/index.js";
import {
  type FunctionSymbol,
  type SemanticModel,
  importedFunctionOf,
} from "../../semantics/index.js";
import { constantOf } from "../forms/index.js";

export class Definitions {
  readonly #document: JsonValue;
  readonly #functions: ReadonlyMap<string, FunctionSymbol>;

  constructor(model: SemanticModel) {
    this.#document = constantOf(model.source.document);
    this.#functions = model.symbols.components.functions;
  }

  get document(): JsonValue {
    return this.#document;
  }

  definitionOf(pointer: string): JsonValue {
    const definition = this.#pointedValueOf(pointer);

    if (definition === null) {
      throw new InterpreterError(
        `No task stands at '${pointer}' in the document or an import.`,
      );
    }

    return definition;
  }

  #pointedValueOf(pointer: string): JsonValue {
    const holder = importedFunctionOf(pointer, this.#functions);

    if (holder === null) {
      return pointedValueOf(this.#document, pointer);
    }

    const inner = relativePointerOf(holder.task.pointer, pointer);
    const imported = pointedValueOf(holder.definition, inner);

    return constantOf(imported);
  }
}
