import { InterpreterError } from "../../runtime/index.js";
import type { FunctionSymbol } from "../../semantics/index.js";
import { type Procedure, procedure } from "../forms/index.js";
import type { Context, Extending } from "./context.js";
import { taskFlowOf } from "./data-flow.js";
import { procedureKeyOf } from "./procedures.js";

export class TranslatedProcedures {
  readonly #procedures = new Map<string, Procedure>();
  readonly #translating = new Set<string>();

  procedureOf(called: FunctionSymbol, context: Context): Procedure {
    const key = procedureKeyOf(called.name, context.extending);
    const known = this.#procedures.get(key);

    if (known !== undefined) {
      return known;
    }

    this.#checkUnreached(called, key);
    this.#translating.add(key);
    const translated = this.#translatedOf(called, key, context);
    this.#translating.delete(key);
    this.#procedures.set(key, translated);

    return translated;
  }

  #checkUnreached(called: FunctionSymbol, key: string): void {
    const isTranslating = this.#translating.has(key);

    if (!isTranslating) {
      return;
    }

    throw new InterpreterError(
      `The function '${called.name}' reaches itself while it is translated: the analysis refuses a recursive function.`,
    );
  }

  #translatedOf(
    called: FunctionSymbol,
    key: string,
    context: Context,
  ): Procedure {
    const closed = context.closed();
    const variant = this.#variantOf(context.extending, closed);
    const body = taskFlowOf(called.task, variant);

    return procedure({ key, name: called.name, body });
  }

  #variantOf(extending: Extending, closed: Context): Context {
    switch (extending) {
      case "extended":
        return closed;
      case "unextended":
        return closed.unextended();
    }
  }
}
