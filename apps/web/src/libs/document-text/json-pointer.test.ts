import { describe, expect, it } from 'vitest';
import { isWithin, pointerOf, tokensOf } from './json-pointer';

describe('a json pointer', () => {
  it('splits_into_its_unescaped_tokens', () => {
    expect(tokensOf('/do/0/a~1b/c~0d')).toEqual(['do', '0', 'a/b', 'c~d']);
    expect(tokensOf('')).toEqual([]);
  });

  it('is_written_back_from_tokens_with_escapes', () => {
    const tokens = ['do', 0, 'a/b', 'c~d'];

    expect(pointerOf(tokens)).toBe('/do/0/a~1b/c~0d');
    expect(pointerOf([])).toBe('');
  });

  it('a_pointer_and_its_tokens_round_trip', () => {
    const pointer = '/~01/~10';
    const tokens = tokensOf(pointer);

    expect(pointerOf(tokens)).toBe(pointer);
  });

  it('lies_within_itself_and_its_parents_but_not_a_sibling_with_a_longer_name', () => {
    expect(isWithin('/do/0/fetch', '/do/0')).toBe(true);
    expect(isWithin('/do/0', '/do/0')).toBe(true);
    expect(isWithin('/do/10', '/do/1')).toBe(false);
  });
});
