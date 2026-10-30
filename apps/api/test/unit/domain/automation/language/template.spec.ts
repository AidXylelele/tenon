import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';
import { Template } from '../../../../../src/domain/automation/language/template.js';

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
