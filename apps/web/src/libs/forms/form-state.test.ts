import { describe, expect, it } from 'vitest';
import { field, IDLE } from './form-state';

describe('a submitted form', () => {
  it('reads_a_field_as_its_text', () => {
    const form = new FormData();
    form.set('email', ' ada@example.com ');

    expect(field(form, 'email')).toBe(' ada@example.com ');
  });

  it('a_missing_field_reads_as_empty', () => {
    expect(field(new FormData(), 'email')).toBe('');
  });

  it('a_file_reads_as_empty', () => {
    const form = new FormData();
    const file = new File(['secret'], 'value.txt');
    form.set('value', file);

    expect(field(form, 'value')).toBe('');
  });

  it('before_it_is_sent_it_has_no_problem_no_result_and_no_values', () => {
    expect(IDLE).toEqual({ problem: null, done: false, values: {} });
  });
});
