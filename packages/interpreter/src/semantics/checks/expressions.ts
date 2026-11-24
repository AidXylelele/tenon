import type { ExpressionLanguage } from "../../runtime/index.js";
import type { Finding } from "../../syntax/index.js";
import type { ExpressionResolution } from "../resolve/index.js";
import { isEvaluated } from "./expression-language.js";
import type { CheckSubject } from "./types.js";

const none: readonly Finding[] = [];

export function checkExpressions(subject: CheckSubject): readonly Finding[] {
  const evaluated = isEvaluated(subject);

  if (!evaluated) {
    return none;
  }

  const resolutions = [...subject.resolutions.values()];
  const strict = resolutions.filter(
    ({ expression }) => expression.mode === "strict",
  );

  return strict.flatMap((resolution) =>
    compilationFindingsOf(resolution, subject.expressions),
  );
}

function compilationFindingsOf(
  resolution: ExpressionResolution,
  expressions: ExpressionLanguage,
): readonly Finding[] {
  const { pointer, source } = resolution.expression;
  const names = [...resolution.bindings.keys()];
  const compilation = expressions.compile(source, names);

  switch (compilation.kind) {
    case "compiled":
      return none;
    case "invalid":
      return [invalidExpressionOf(pointer, [source, compilation.message])];
    case "unknown-variable":
      return [unknownVariableOf(pointer, `$${compilation.variable}`)];
  }
}

function invalidExpressionOf(
  pointer: string,
  details: readonly [source: string, problem: string],
): Finding<"invalidExpression"> {
  return {
    name: "invalidExpression",
    code: "expression",
    pointer,
    subject: null,
    details,
    import: null,
  };
}

function unknownVariableOf(
  pointer: string,
  variable: string,
): Finding<"unknownVariable"> {
  return {
    name: "unknownVariable",
    code: "unknown-variable",
    pointer,
    subject: variable,
    details: [variable],
    import: null,
  };
}
