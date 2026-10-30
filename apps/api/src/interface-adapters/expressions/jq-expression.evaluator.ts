import { Injectable } from '@nestjs/common';
import { ExpressionEvaluator } from '../../application/automation/language/ports.js';
import type { Expression } from '../../domain/automation/language/expression.js';
import { InvalidExpressionError } from '../../domain/errors.js';
import { JqOutcomeKind } from './enums.js';
import { JqClient } from './interfaces.js';

@Injectable()
export class JqExpressionEvaluator implements ExpressionEvaluator {
  constructor(private readonly client: JqClient) {}

  async check(expressions: readonly Expression[]): Promise<void> {
    for (const expression of expressions) {
      const compilation = await this.client.compile(expression.program);

      if (compilation.kind === JqOutcomeKind.Failure)
        throw new InvalidExpressionError(
          expression.pointer,
          compilation.failure,
        );
    }
  }
}
