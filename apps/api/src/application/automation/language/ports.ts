import type { Expression } from '../../../domain/automation/language/expression.js';
import type { Problem } from '../../../domain/automation/language/problem.js';

export abstract class ExpressionEvaluator {
  abstract check(
    expressions: readonly Expression[],
  ): Promise<readonly Problem[]>;
}
