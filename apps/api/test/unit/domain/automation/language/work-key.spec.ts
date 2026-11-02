import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';
import { WorkKey } from '../../../../../src/domain/automation/language/work-key.js';

// Stored progress finds its results by these ids, so their format must not change.
describe('WorkKey', () => {
  const key = WorkKey.of('task-1');
  const pointer = JsonPointer.root().at('do').at(0).at('loop').at('while');

  it('a_declared_expression_is_identified_by_its_pointer', () => {
    expect(key.idOf(pointer)).toBe('task-1:/do/0/loop/while');
  });

  it('a_pass_of_a_repeating_stage_is_identified_by_its_count', () => {
    const third = key.within('while', 3);

    expect(third.idOf(pointer)).toBe('task-1:while-3:/do/0/loop/while');
  });

  it('the_task_s_own_work_is_identified_by_its_name_and_count', () => {
    expect(key.idFor('call')).toBe('task-1:call');
    expect(key.countedIdFor('retry', 2)).toBe('task-1:retry-2');
  });
});
