import { describe, expect, it } from 'vitest';
import {
  isObject,
  type JsonObject,
  valueAt,
  withMember,
  withoutValue,
  withValue,
} from './json';

const DOCUMENT: JsonObject = {
  document: { name: 'route-lead', 'a/b': 1, 'c~d': 2 },
  do: [{ fetch: { call: 'http' } }, { notify: { call: 'email' } }],
};

describe('a json document read and written by pointer', () => {
  it('an_object_is_neither_null_nor_an_array', () => {
    expect(isObject({})).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject('text')).toBe(false);
  });

  it('reads_members_and_items_with_escaped_tokens', () => {
    expect(valueAt(DOCUMENT, '/do/1/notify/call')).toBe('email');
    expect(valueAt(DOCUMENT, '/document/a~1b')).toBe(1);
    expect(valueAt(DOCUMENT, '/document/c~0d')).toBe(2);
    expect(valueAt(DOCUMENT, '')).toBe(DOCUMENT);
  });

  it('a_path_that_does_not_exist_reads_as_undefined', () => {
    expect(valueAt(DOCUMENT, '/do/5/fetch')).toBeUndefined();
    expect(valueAt(DOCUMENT, '/document/name/first')).toBeUndefined();
  });

  it('a_write_returns_a_new_document_and_leaves_the_given_one_as_it_was', () => {
    const before = structuredClone(DOCUMENT);

    const written = withValue(DOCUMENT, '/do/0/fetch/call', 'grpc');

    expect(valueAt(written, '/do/0/fetch/call')).toBe('grpc');
    expect(DOCUMENT).toEqual(before);
    expect(written.document).toBe(DOCUMENT.document);
  });

  it('a_write_creates_the_objects_missing_on_the_way', () => {
    const written = withValue(DOCUMENT, '/input/schema/format', 'json');

    expect(written.input).toEqual({ schema: { format: 'json' } });
  });

  it('removes_a_member_or_an_item', () => {
    const withoutName = withoutValue(DOCUMENT, '/document/name');
    const withoutFirst = withoutValue(DOCUMENT, '/do/0');

    expect(withoutName.document).toEqual({ 'a/b': 1, 'c~d': 2 });
    expect(withoutFirst.do).toEqual([{ notify: { call: 'email' } }]);
  });

  it('removing_what_is_missing_leaves_the_document_as_it_is', () => {
    expect(withoutValue(DOCUMENT, '/document/version')).toBe(DOCUMENT);
    expect(withoutValue(DOCUMENT, '')).toBe(DOCUMENT);
  });

  it('a_member_set_to_nothing_or_an_empty_text_is_removed', () => {
    const set = withMember(DOCUMENT, '/document/title', 'Route a lead');
    const cleared = withMember(set, '/document/title', '');
    const unset = withMember(set, '/document/title', undefined);

    expect(valueAt(set, '/document/title')).toBe('Route a lead');
    expect(cleared).toEqual(DOCUMENT);
    expect(unset).toEqual(DOCUMENT);
  });
});
