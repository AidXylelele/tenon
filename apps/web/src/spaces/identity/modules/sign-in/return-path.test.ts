import { describe, expect, it } from 'vitest';
import { returnPath } from './return-path';

describe('the page to return to after signing in', () => {
  it('is_a_path_of_the_console_with_its_query', () => {
    expect(returnPath('/instances?phase=faulted')).toBe(
      '/instances?phase=faulted',
    );
  });

  it.each([
    ['https://evil.example'],
    ['//evil.example'],
    ['/\\evil.example'],
    ['/\t/evil.example'],
    ['/\n/evil.example'],
    ['evil'],
  ])('never_leaves_the_console_for_%j', (next) => {
    expect(returnPath(next)).toBe('/');
  });

  it('without_one_it_is_the_start_page', () => {
    expect(returnPath(undefined)).toBe('/');
  });
});
