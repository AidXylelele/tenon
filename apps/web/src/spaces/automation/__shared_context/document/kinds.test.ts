import { describe, expect, it } from 'vitest';
import { KINDS, newTask } from './kinds';
import { kindOf } from './tasks';

describe('the tasks a builder adds', () => {
  it.each(KINDS.map((info) => [info.kind]))(
    'a_new_%s_task_is_read_back_as_its_kind',
    (kind) => {
      expect(kindOf(newTask(kind))).toBe(kind);
    },
  );

  it('each_new_task_is_its_own_copy', () => {
    const first = newTask('set');
    const second = newTask('set');

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
