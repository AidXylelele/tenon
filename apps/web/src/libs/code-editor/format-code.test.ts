import { describe, expect, it } from 'vitest';
import { formatCode, formattable } from './format-code';

describe('formatting code', () => {
  it('is_offered_for_javascript_and_json_only', () => {
    expect(formattable('javascript')).toBe(true);
    expect(formattable('json')).toBe(true);
    expect(formattable('python')).toBe(false);
    expect(formattable('yaml')).toBe(false);
  });

  it('lays_json_out_with_two_spaces', async () => {
    const formatted = await formatCode('{"a":[1,2],"b":{"c":true}}', 'json');

    expect(formatted).toBe(
      '{\n  "a": [\n    1,\n    2\n  ],\n  "b": {\n    "c": true\n  }\n}',
    );
  });

  it('json_that_does_not_parse_is_refused', async () => {
    const formatting = formatCode('{"a":', 'json');

    await expect(formatting).rejects.toThrow(SyntaxError);
  });

  it('lays_javascript_out_the_way_prettier_does', async () => {
    const formatted = await formatCode(
      'const total=items.reduce((sum,item)=>sum+item.price,0)',
      'javascript',
    );

    expect(formatted).toBe(
      'const total = items.reduce((sum, item) => sum + item.price, 0);\n',
    );
  });

  it('javascript_that_does_not_parse_is_refused', async () => {
    const formatting = formatCode('const = ;', 'javascript');

    await expect(formatting).rejects.toThrow();
  });
});
