import { describe, expect, it, vi } from 'vitest';
import { segment, single } from './segment';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  },
}));

describe('a route segment and a search parameter', () => {
  it('a_segment_reads_as_its_decoded_text', () => {
    expect(segment('sales%2Fleads')).toBe('sales/leads');
    expect(segment('route-lead')).toBe('route-lead');
  });

  it('a_malformed_escape_is_a_page_that_does_not_exist', () => {
    expect(() => segment('%zz')).toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });

  it('a_parameter_given_once_is_its_value', () => {
    expect(single({ phase: 'faulted' }, 'phase')).toBe('faulted');
  });

  it('an_absent_empty_or_repeated_parameter_is_undefined', () => {
    const query = { empty: '', repeated: ['a', 'b'] };

    expect(single(query, 'absent')).toBeUndefined();
    expect(single(query, 'empty')).toBeUndefined();
    expect(single(query, 'repeated')).toBeUndefined();
  });
});
