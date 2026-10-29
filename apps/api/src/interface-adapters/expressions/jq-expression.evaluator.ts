import { Injectable } from '@nestjs/common';
import { type ResiliencePolicy, ResilienceService } from '@nestjs/resilience';
import { ExpressionEvaluator } from '../../application/automation/language/ports.js';
import type { Expression } from '../../domain/automation/language/expression.js';
import { Problem } from '../../domain/automation/language/problem.js';
import { RuntimeArguments } from '../../domain/automation/language/runtime-arguments.js';
import { JqPool, type JqTask } from '../interfaces.js';

const UNBOUND = 'null';

@Injectable()
export class JqExpressionEvaluator implements ExpressionEvaluator {
  readonly #policy: ResiliencePolicy;

  constructor(
    private readonly pool: JqPool,
    resilience: ResilienceService,
  ) {
    this.#policy = resilience.preset('jq');
  }

  async check(expressions: readonly Expression[]): Promise<readonly Problem[]> {
    const checks = expressions.map((expression) => this.#check(expression));
    const outcomes = await Promise.all(checks);
    return outcomes.filter((problem) => problem !== null);
  }

  async #check(expression: Expression): Promise<Problem | null> {
    const names = expression.variables.concat(RuntimeArguments.NAMES);
    const bound: Record<string, string> = {};

    for (const name of names) bound[name] = UNBOUND;

    const task: JqTask = {
      program: `empty | (${expression.program})`,
      input: UNBOUND,
      arguments: bound,
    };
    const outcome = await this.#policy.execute(({ signal }) =>
      this.pool.run(task, { signal }),
    );

    if ('values' in outcome) return null;

    return new Problem(
      expression.pointer,
      `Invalid expression: ${outcome.failure}`,
    );
  }
}
