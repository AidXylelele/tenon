import { describe, expect, it } from 'vitest';
import { formatOf, parseText, rangeOf, stringifyText } from './document-text';

const YAML_TEXT = `document:
  dsl: '1.0.3'
  name: route-lead
do:
  - fetch:
      call: http
      with:
        endpoint: https://crm.example.com
`;

describe('a document as text', () => {
  it('reads_yaml_and_json_alike', () => {
    const yaml = parseText(YAML_TEXT);
    const json = parseText(stringifyText(yaml.ok ? yaml.value : null, 'json'));

    expect(json).toEqual(yaml);
  });

  it('a_parse_error_says_where_it_is', () => {
    const parsed = parseText('document:\n  name: [unclosed\n');

    expect(parsed.ok).toBe(false);
    expect(parsed.ok ? 0 : parsed.error.line).toBeGreaterThan(1);
  });

  it('a_duplicate_key_is_an_error', () => {
    expect(parseText('a: 1\na: 2\n').ok).toBe(false);
  });

  it('a_pointer_is_found_at_its_member', () => {
    const range = rangeOf(YAML_TEXT, '/do/0/fetch/with/endpoint');

    expect(range && YAML_TEXT.slice(range.from, range.to)).toBe(
      'endpoint: https://crm.example.com',
    );
  });

  it('a_pointer_past_the_text_falls_back_to_the_deepest_part_that_exists', () => {
    const range = rangeOf(YAML_TEXT, '/do/0/fetch/with/method');

    expect(range && YAML_TEXT.slice(range.from, range.to)).toContain('with:');
  });

  it('aliases_expand_up_to_a_bound_and_past_it_are_refused', () => {
    const many = Array.from({ length: 101 }, () => '*a').join(', ');
    const text = `a: &a x\nb: [${many}]\n`;

    const few = parseText('a: &a x\nb: [*a, *a]\n');
    const parsed = parseText(text);

    expect(few).toEqual({ ok: true, value: { a: 'x', b: ['x', 'x'] } });
    expect(parsed.ok).toBe(false);
  });

  it('writes_yaml_without_folding_long_lines', () => {
    const endpoint = `https://crm.example.com/${'a'.repeat(120)}`;
    const value = { endpoint };

    expect(stringifyText(value, 'yaml')).toBe(`endpoint: ${endpoint}\n`);
  });

  it('writes_json_indented_with_a_final_newline', () => {
    expect(stringifyText({ a: 1 }, 'json')).toBe('{\n  "a": 1\n}\n');
  });

  it('a_pointer_into_text_without_a_document_has_no_range', () => {
    expect(rangeOf('', '/do')).toBeNull();
  });

  it('tells_json_from_yaml', () => {
    expect(formatOf('  {"a": 1}')).toBe('json');
    expect(formatOf('a: 1')).toBe('yaml');
  });
});
