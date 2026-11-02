import { Injectable } from '@nestjs/common';
import { ExpressionEvaluator } from '../../../application/automation/language/ports.js';
import type { Expression } from '../../../domain/automation/language/expression.js';
import type { Evaluation } from '../../../domain/automation/language/interfaces.js';
import { Evaluated } from '../../../domain/automation/language/results/evaluated.js';
import { EvaluationFailed } from '../../../domain/automation/language/results/evaluation-failed.js';
import type { EvaluationResult } from '../../../domain/automation/language/results/evaluation-result.js';
import { InvalidExpressionError } from '../../../domain/errors.js';
import { JqOutcomeKind } from './enums.js';
import { JqClient } from './interfaces.js';

@Injectable()
export class JqExpressionEvaluator implements ExpressionEvaluator {
  private static readonly SEVERAL =
    'The expression produced more than one value';
  private static readonly OUT_OF_TIME = 'The expression ran out of time';
  private static readonly OUT_OF_MEMORY = 'The expression ran out of memory';

  constructor(private readonly client: JqClient) {}

  async check(expressions: readonly Expression[]): Promise<void> {
    for (const expression of expressions) {
      const compilation = await this.client.compile(expression.program);

      if (compilation.kind === JqOutcomeKind.Failure)
        throw new InvalidExpressionError(
          expression.pointer,
          compilation.failure,
        );

      if (compilation.kind === JqOutcomeKind.TimedOut)
        throw new InvalidExpressionError(
          expression.pointer,
          JqExpressionEvaluator.OUT_OF_TIME,
        );

      if (compilation.kind === JqOutcomeKind.Aborted)
        throw new InvalidExpressionError(
          expression.pointer,
          JqExpressionEvaluator.OUT_OF_MEMORY,
        );
    }
  }

  async evaluateAll(
    evaluations: readonly Evaluation[],
  ): Promise<readonly EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const evaluation of evaluations) {
      const result = await this.#evaluate(evaluation);
      results.push(result);
    }

    return results;
  }

  async #evaluate(evaluation: Evaluation): Promise<EvaluationResult> {
    const evaluated = await this.client.evaluate(
      evaluation.program,
      evaluation.data,
      evaluation.arguments,
    );

    if (evaluated.kind === JqOutcomeKind.Failure)
      return new EvaluationFailed(evaluation.id, evaluated.failure);

    if (evaluated.kind === JqOutcomeKind.TimedOut)
      return new EvaluationFailed(
        evaluation.id,
        JqExpressionEvaluator.OUT_OF_TIME,
      );

    if (evaluated.kind === JqOutcomeKind.Aborted)
      return new EvaluationFailed(
        evaluation.id,
        JqExpressionEvaluator.OUT_OF_MEMORY,
      );

    const values = evaluated.values;

    if (values.length > 1)
      return new EvaluationFailed(evaluation.id, JqExpressionEvaluator.SEVERAL);

    const value = values[0] ?? null;
    return new Evaluated(evaluation.id, value);
  }
}
