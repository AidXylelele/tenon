import type { ExpressionLanguage } from "../../runtime/index.js";
import type { ExpressionResolution } from "./types.js";

export function readsAsExpression(
  resolution: ExpressionResolution,
  expressions: ExpressionLanguage,
): boolean {
  const { source, mode } = resolution.expression;

  switch (mode) {
    case "strict":
      return true;
    case "loose": {
      const names = [...resolution.bindings.keys()];
      const compilation = expressions.compile(source, names);
      return compilation.kind === "compiled";
    }
  }
}
