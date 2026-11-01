import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';
import { RoundWork } from '../../../../../src/domain/automation/language/round-work.js';
import { Template } from '../../../../../src/domain/automation/language/template.js';
import { answer, evaluatedAs } from '../../../../support/progress.js';

describe('Template', () => {
  it('only_whole_runtime_expression_leaves_are_expressions', () => {
    const pointer = JsonPointer.root().at('do').at(0).at('call').at('with');
    const template = new Template({
      pointer,
      value: {
        method: 'get',
        endpoint: '${ "https://api.example.com/" + .id }',
        headers: [{ token: '${$secrets.token}' }, 'price is ${ 5 } USD'],
      },
    });

    const located = template.expressions.map((expression) => [
      expression.pointer.toString(),
      expression.program,
    ]);

    expect(located).toEqual([
      ['/do/0/call/with/endpoint', '"https://api.example.com/" + .id'],
      ['/do/0/call/with/headers/0/token', '$secrets.token'],
    ]);
  });
});

describe('Template filling', () => {
  it('each_runtime_leaf_becomes_one_evaluation_and_its_value_is_filled_back', () => {
    const pointer = JsonPointer.root().at('do').at(0).at('greet').at('set');
    const template = new Template({
      pointer,
      value: { greeting: '${ .name }', fixed: 'hi', list: ['${ .age }'] },
    });

    const evaluations = template.evaluationsFor('t:', { name: 'Ann' }, {});
    const results = answer(RoundWork.evaluating(evaluations), {
      evaluate: evaluatedAs((evaluation) =>
        evaluation.program === '.name' ? 'Ann' : 30,
      ),
    });

    expect(evaluations.map((evaluation) => evaluation.id)).toEqual([
      't:/do/0/greet/set/greeting',
      't:/do/0/greet/set/list/0',
    ]);
    expect(template.fill('t:', results)).toEqual({
      greeting: 'Ann',
      fixed: 'hi',
      list: [30],
    });
  });
});
