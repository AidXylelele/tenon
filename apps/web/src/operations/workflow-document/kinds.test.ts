import { describe, expect, it } from 'vitest';
import { infoOf, KINDS, newTask } from './kinds';
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

  it('a_construct_without_a_form_is_advanced_and_starts_empty', () => {
    expect(infoOf('advanced').label).toBe('Advanced');
    expect(newTask('advanced')).toEqual({ set: {} });
  });
});
