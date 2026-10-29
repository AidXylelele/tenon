import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Expression } from '../../../src/domain/automation/language/expression.js';
import { ResilienceModule } from '../../../src/frameworks/di/resilience.module.js';
import { createJqPool } from '../../../src/frameworks/jq/jq-pool.js';
import { JqExpressionEvaluator } from '../../../src/interface-adapters/expressions/jq-expression.evaluator.js';
import { JqPool } from '../../../src/interface-adapters/interfaces.js';

function expression(
  pointer: string,
  program: string,
  variables: readonly string[] = [],
): Expression {
  return new Expression({ pointer, program, variables });
}

describe('JqExpressionEvaluator', () => {
  let app: INestApplication;
  let evaluator: JqExpressionEvaluator;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule],
      providers: [
        JqExpressionEvaluator,
        { provide: JqPool, useFactory: createJqPool },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    evaluator = app.get(JqExpressionEvaluator);
  });

  afterAll(async () => {
    await app.get(JqPool).destroy();
    await app.close();
  });

  it('expressions_that_use_the_runtime_arguments_and_their_own_variables_pass', async () => {
    const problems = await evaluator.check([
      expression('/do/0/a/set/x', '.a + $input.b'),
      expression('/do/0/a/set/y', '$context.total * 2'),
      expression('/do/1/loop/do/0/b/set/z', '$item.price', ['item', 'index']),
      expression('/do/2/guarded/catch/when', '$error.status == 503', ['error']),
    ]);

    expect(problems).toEqual([]);
  });

  it('a_syntax_error_and_an_unknown_variable_are_reported_where_they_stand', async () => {
    const problems = await evaluator.check([
      expression('/do/0/a/set/x', '.a | map(. + )'),
      expression('/do/0/a/set/y', '$nope + 1'),
    ]);

    expect(
      problems.map((problem) => [problem.pointer, problem.reason]),
    ).toEqual([
      ['/do/0/a/set/x', "Invalid expression: syntax error, unexpected ')'"],
      ['/do/0/a/set/y', 'Invalid expression: $nope is not defined'],
    ]);
  });
});
