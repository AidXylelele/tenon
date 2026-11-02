import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';
import { WorkKey } from '../../../../../src/domain/automation/language/work-key.js';

// Stored progress finds its results by these ids, so their format must not change.
describe('WorkKey', () => {
  const key = WorkKey.of('task-1');
  const pointer = JsonPointer.root().at('do').at(0).at('loop').at('while');

  it('a_declared_expression_is_identified_by_its_pointer', () => {
    expect(key.idAt(pointer)).toBe('task-1:/do/0/loop/while');
  });

  it('a_pass_of_a_repeating_stage_is_identified_by_its_count', () => {
    const third = key.within('while', 3);

    expect(third.idAt(pointer)).toBe('task-1:while-3:/do/0/loop/while');
  });

  it('work_on_the_context_is_identified_by_the_context_whatever_its_key_order', () => {
    const one = key.onContext({ a: 1, b: [1, { c: 2, d: 3 }] });
    const reordered = key.onContext({ b: [1, { d: 3, c: 2 }], a: 1 });
    const other = key.onContext({ a: 2 });

    expect(one.idAt(pointer)).toBe(reordered.idAt(pointer));
    expect(one.idAt(pointer)).not.toBe(other.idAt(pointer));
    expect(one.idAt(pointer)).toMatch(/^task-1:context-[0-9a-f]{16}:\/do/);
  });

  it('the_task_s_own_work_is_identified_by_its_name_and_count', () => {
    expect(key.idFor('call')).toBe('task-1:call');
    expect(key.countedIdFor('retry', 2)).toBe('task-1:retry-2');
  });
});
