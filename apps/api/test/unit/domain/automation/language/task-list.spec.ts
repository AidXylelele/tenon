import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';
import { DoTask } from '../../../../../src/domain/automation/language/tasks/do-task.js';
import {
  DuplicateTaskError,
  UnknownTaskError,
} from '../../../../../src/domain/errors.js';
import {
  baseAt,
  rejectionOf,
  setTask,
  taskList,
} from '../../../../support/language.js';

describe('TaskList', () => {
  const body = JsonPointer.root().at('do');

  it('two_tasks_with_one_name_are_refused_at_the_second', () => {
    const first = setTask(body, 0, 'greet');
    const second = setTask(body, 1, 'greet');

    const rejection = rejectionOf(() => taskList(body, [first, second]));

    expect(rejection).toBeInstanceOf(DuplicateTaskError);
    expect(rejection.pointer).toBe('/do/1/greet');
  });

  it('a_directive_names_a_flow_keyword_or_a_task_of_its_own_list', () => {
    const tasks = [
      setTask(body, 0, 'first', 'last'),
      setTask(body, 1, 'second', 'continue'),
      setTask(body, 2, 'third', 'exit'),
      setTask(body, 3, 'last', 'end'),
    ];

    const list = taskList(body, tasks);

    expect(list.tasks).toHaveLength(4);
  });

  it('a_directive_naming_a_task_of_another_list_is_refused_where_it_stands', () => {
    const wrapper = body.at(0).at('wrapper');
    const innerAt = wrapper.at('do');
    const inner = setTask(innerAt, 0, 'inner', 'after');

    const rejection = rejectionOf(() => taskList(innerAt, [inner]));

    expect(rejection).toBeInstanceOf(UnknownTaskError);
    expect(rejection.pointer).toBe('/do/0/wrapper/do/0/inner/then');
  });

  it('nested_lists_keep_their_own_names', () => {
    const wrapperAt = body.at(0).at('greet');
    const innerAt = wrapperAt.at('do');
    const inner = taskList(innerAt, [setTask(innerAt, 0, 'greet')]);
    const wrapper = new DoTask({
      name: 'greet',
      reference: wrapperAt,
      base: baseAt(wrapperAt),
      body: inner,
    });

    const list = taskList(body, [wrapper]);

    expect(
      list.expressions.map((expression) => expression.pointer.toString()),
    ).toEqual(['/do/0/greet/do/0/greet/set/greeting']);
  });
});
