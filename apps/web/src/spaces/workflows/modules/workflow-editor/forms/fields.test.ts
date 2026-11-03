import { describe, expect, it } from 'vitest';
import { textOfValue, valueOfText } from './fields';

describe('a value typed in a form', () => {
  it('numbers_booleans_null_and_json_are_themselves', () => {
    expect(valueOfText('42')).toBe(42);
    expect(valueOfText('true')).toBe(true);
    expect(valueOfText('null')).toBeNull();
    expect(valueOfText('{"a": 1}')).toEqual({ a: 1 });
  });

  it('an_expression_and_other_text_stay_text', () => {
    expect(valueOfText('${ .lead.email }')).toBe('${ .lead.email }');
    expect(valueOfText('Hello')).toBe('Hello');
    expect(valueOfText('{ not json')).toBe('{ not json');
  });

  it('a_value_reads_back_as_the_text_that_gives_it', () => {
    for (const value of [42, true, { a: 1 }, 'Hello'])
      expect(valueOfText(textOfValue(value))).toEqual(value);
  });
});
