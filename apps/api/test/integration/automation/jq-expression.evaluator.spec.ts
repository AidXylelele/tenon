import { ResilienceService } from '@nestjs/resilience';
import { Test } from '@nestjs/testing';
import { Expression } from '../../../src/domain/automation/language/expression.js';
import { JsonPointer } from '../../../src/domain/automation/language/json-pointer.js';
import { InvalidExpressionError } from '../../../src/domain/errors.js';
import { ResilienceModule } from '../../../src/frameworks/di/resilience.module.js';
import { PiscinaJqClient } from '../../../src/frameworks/jq/piscina-jq.client.js';
import { JqExpressionEvaluator } from '../../../src/interface-adapters/workflows/expressions/jq-expression.evaluator.js';

const set = JsonPointer.root().at('do').at(0).at('compute').at('set');

function expression(field: string, program: string): Expression {
  const pointer = set.at(field);
  return new Expression({ pointer, program });
}

describe('JqExpressionEvaluator', () => {
  let client: PiscinaJqClient;
  let evaluator: JqExpressionEvaluator;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule],
    }).compile();
    const resilience = moduleRef.get(ResilienceService);
    client = new PiscinaJqClient(resilience);
    evaluator = new JqExpressionEvaluator(client);
  });

  afterAll(async () => {
    await client.onApplicationShutdown();
  });

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

  it('an_evaluation_runs_with_its_data_and_runtime_arguments', async () => {
    const [result] = await evaluator.evaluateAll([
      {
        id: 'w:1',
        program: '.a + $input.b',
        data: { a: 1 },
        arguments: { input: { b: 2 } },
      },
    ]);

    expect(result?.value).toBe(3);
    expect(result?.failure(set)).toBeNull();
  });

  it('a_program_with_no_output_gives_null_and_several_give_an_expression_error', async () => {
    const [none, many] = await evaluator.evaluateAll([
      { id: 'w:1', program: 'empty', data: null, arguments: {} },
      { id: 'w:2', program: '.[]', data: [1, 2], arguments: {} },
    ]);

    expect(none?.value).toBeNull();
    expect(many?.failure(set)?.status).toBe(400);
    expect(many?.failure(set)?.detail).toBe(
      'The expression produced more than one value',
    );
  });

  it('a_program_ending_in_a_comment_is_published_and_evaluated_alike', async () => {
    const check = evaluator.check([expression('total', '1 # one')]);
    const [result] = await evaluator.evaluateAll([
      { id: 'w:1', program: '1 # one', data: null, arguments: {} },
    ]);

    await expect(check).resolves.toBeUndefined();
    expect(result?.value).toBe(1);
  });

  it('a_failing_program_gives_an_expression_error_with_its_reason', async () => {
    const [result] = await evaluator.evaluateAll([
      { id: 'w:1', program: 'error("boom")', data: null, arguments: {} },
    ]);

    expect(result?.failure(set)?.detail).toBe('boom');
    expect(result?.failure(set)?.status).toBe(400);
  });

  it.each(['env', '$ENV', 'input', 'now | localtime', 'halt'])(
    'the_sandbox_prelude_keeps_%s_from_the_host',
    async (program) => {
      const [result] = await evaluator.evaluateAll([
        { id: 'w:1', program, data: null, arguments: {} },
      ]);

      const leaked = result?.failure(set) === null && result.value !== null;
      expect(leaked).toBe(false);
    },
  );

  it('a_runaway_program_gives_an_expression_error', async () => {
    const [result] = await evaluator.evaluateAll([
      {
        id: 'w:1',
        program: 'reduce range(1000000000) as $i (0; . + 1)',
        data: null,
        arguments: {},
      },
    ]);

    expect(result?.failure(set)?.status).toBe(400);
    expect(result?.failure(set)?.detail).toBe('The expression ran out of time');
  });
});
