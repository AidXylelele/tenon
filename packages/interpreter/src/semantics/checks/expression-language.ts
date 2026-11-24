import { childPointerOf } from "../../runtime/index.js";
import type { Finding } from "../../syntax/index.js";
import type { CheckSubject } from "./types.js";

const none: readonly Finding[] = [];

export function checkExpressionLanguage(
  subject: CheckSubject,
): readonly Finding[] {
  const evaluate = subject.workflow.evaluate;

  const evaluated = isEvaluated(subject);

  if (evaluated) {
    return none;
  }

  const finding: Finding<"expressionLanguage"> = {
    name: "expressionLanguage",
    code: "expression-language",
    pointer: childPointerOf(evaluate.pointer, "language"),
    subject: null,
    details: [evaluate.language],
    import: null,
  };
  return [finding];
}

export function isEvaluated(subject: CheckSubject): boolean {
  return subject.workflow.evaluate.language === subject.expressions.name;
}
