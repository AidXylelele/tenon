import { Expression } from '../../../src/domain/automation/language/expression.js';
import { JsonPointer } from '../../../src/domain/automation/language/json-pointer.js';
import { InvalidExpressionError } from '../../../src/domain/errors.js';
import { InProcessJqClient } from '../../../src/frameworks/jq/in-process-jq.client.js';
import { JqExpressionEvaluator } from '../../../src/interface-adapters/expressions/jq-expression.evaluator.js';

const set = JsonPointer.root().at('do').at(0).at('compute').at('set');

function expression(field: string, program: string): Expression {
  const pointer = set.at(field);
  return new Expression({ pointer, program });
}

describe('JqExpressionEvaluator', () => {
  const evaluator = new JqExpressionEvaluator(new InProcessJqClient());

  it('expressions_of_valid_syntax_pass', async () => {
    const check = evaluator.check([
      expression('total', '.a + $input.b'),
      expression('price', '$item.price * 2'),
    ]);

    await expect(check).resolves.toBeUndefined();
  });

  it('the_first_invalid_expression_is_refused_where_it_stands', async () => {
    const check = evaluator.check([
      expression('total', '.a + 1'),
      expression('price', '.a | map(. + )'),
      expression('other', '.b |'),
    ]);

    await expect(check).rejects.toThrow(InvalidExpressionError);
    await expect(check).rejects.toMatchObject({
      pointer: '/do/0/compute/set/price',
      message: "Invalid expression: syntax error, unexpected ')'",
    });
  });
});
