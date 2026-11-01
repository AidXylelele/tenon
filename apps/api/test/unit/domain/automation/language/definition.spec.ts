import { DslVersion } from '../../../../../src/domain/automation/language/enums.js';
import { Definition } from '../../../../../src/domain/automation/language/definition.js';
import { Expression } from '../../../../../src/domain/automation/language/expression.js';
import { Input } from '../../../../../src/domain/automation/language/input.js';
import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';
import { Output } from '../../../../../src/domain/automation/language/output.js';
import { ReusableComponents } from '../../../../../src/domain/automation/language/reusable-components.js';
import type { Task } from '../../../../../src/domain/automation/language/tasks/task.js';
import { DoTask } from '../../../../../src/domain/automation/language/tasks/do-task.js';
import { WorkflowName } from '../../../../../src/domain/automation/language/workflow-name.js';
import { UndeclaredComponentError } from '../../../../../src/domain/errors.js';
import {
  baseAt,
  callTask,
  rejectionOf,
  setTask,
  taskList,
} from '../../../../support/language.js';
import {
  definitionOf as definitionFrom,
  pointerOf,
} from '../../../../support/progress.js';

const root = JsonPointer.root();
const body = root.at('do');

function definitionOf(
  tasks: readonly Task[],
  components: ReusableComponents = ReusableComponents.none(),
  input: Input = Input.none(),
): Definition {
  return new Definition({
    document: {},
    workflow: new WorkflowName('default', 'greet'),
    version: '1.0.0',
    dslVersion: DslVersion.V103,
    input,
    output: Output.none(),
    timeout: null,
    body: taskList(body, tasks),
    components,
  });
}

describe('Definition', () => {
  it('every_expression_of_the_document_is_listed_with_its_place', () => {
    const fromAt = root.at('input').at('from');
    const from = Expression.of({ text: '${ .order }', pointer: fromAt });
    const input = new Input({ from, schema: null });

    const definition = definitionOf(
      [setTask(body, 0, 'greet')],
      undefined,
      input,
    );

    const located = definition.expressions.map((expression) => [
      expression.pointer.toString(),
      expression.program,
    ]);
    expect(located).toEqual([
      ['/input/from', '.order'],
      ['/do/0/greet/set/greeting', '.name'],
    ]);
  });

  it('a_call_to_a_function_that_use_does_not_declare_is_refused_where_it_is_named', () => {
    const outerAt = body.at(0).at('outer');
    const innerAt = outerAt.at('do');
    const charge = callTask(innerAt.at(0).at('charge'), 'charge', 'settle');
    const outer = new DoTask({
      name: 'outer',
      reference: outerAt,
      base: baseAt(outerAt),
      body: taskList(innerAt, [charge]),
    });

    const rejection = rejectionOf(() => definitionOf([outer]));

    expect(rejection).toBeInstanceOf(UndeclaredComponentError);
    expect(rejection.message).toBe('"settle" is not declared in use.functions');
    expect(rejection.pointer).toBe('/do/0/outer/do/0/charge/call');
  });
});

describe('Definition lookups', () => {
  it('every_task_and_declared_function_is_found_by_its_reference', () => {
    const definition = definitionFrom(
      [{ outer: { do: [{ inner: { set: { a: 1 } } }] } }],
      {
        functions: {
          getPet: {
            call: 'http',
            with: { method: 'get', endpoint: 'https://petstore.example' },
          },
        },
      },
    );

    const names = [
      '',
      '/do/0/outer',
      '/do/0/outer/do/0/inner',
      '/use/functions/getPet',
    ]
      .map(pointerOf)
      .map((pointer) => definition.taskAt(pointer).name);

    expect(names).toEqual(['test', 'outer', 'inner', 'getPet']);
  });

  it('the_json_of_a_task_is_read_from_the_document', () => {
    const definition = definitionFrom([{ greet: { set: { a: 1 } } }]);

    const json = definition.jsonAt(pointerOf('/do/0/greet'));

    expect(json).toEqual({ set: { a: 1 } });
  });
});
