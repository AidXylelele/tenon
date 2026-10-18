import { ProblemCode } from '../../../src/domain/enums.js';
import { RenameKeysNode } from '../../../src/interface-adapters/node-types/types/rename-keys.node.js';
import { fixed, formula, runNode } from '../../support/node-runs.js';

const items = [
  { user_name: 'ada', user_email: 'ada@shop.test', meta: { sku: 'K-1' } },
  { user_name: 'bob', meta: { sku: 'L-1' } },
];

const rename = (parameters: Record<string, unknown>) =>
  runNode(new RenameKeysNode(), { items, parameters });

describe('Rename Keys', () => {
  it('moves_an_existing_field_to_its_new_name_and_leaves_items_without_it_alone', async () => {
    const result = await rename({
      pairs: [{ from: fixed('user_email'), to: fixed('email') }],
    });
    expect(result.main).toEqual([
      { user_name: 'ada', email: 'ada@shop.test', meta: { sku: 'K-1' } },
      { user_name: 'bob', meta: { sku: 'L-1' } },
    ]);
  });

  it('applies_the_pairs_in_turn', async () => {
    const result = await rename({
      pairs: [
        { from: fixed('user_name'), to: fixed('name') },
        { from: fixed('name'), to: fixed('login') },
      ],
    });
    expect(result.main?.[1]).toEqual({ login: 'bob', meta: { sku: 'L-1' } });
  });

  it('renames_nested_fields_by_dot_path', async () => {
    const result = await rename({
      pairs: [{ from: fixed('meta.sku'), to: fixed('product.code') }],
    });
    expect(result.main?.[0]).toEqual({
      user_name: 'ada',
      user_email: 'ada@shop.test',
      meta: {},
      product: { code: 'K-1' },
    });
  });

  it('without_dot_notation_a_name_with_dots_is_one_key', async () => {
    const result = await runNode(new RenameKeysNode(), {
      items: [{ 'a.b': 1, a: { b: 2 } }],
      parameters: {
        pairs: [{ from: fixed('a.b'), to: fixed('c.d') }],
        dotNotation: fixed(false),
      },
    });
    expect(result.main).toEqual([{ a: { b: 2 }, 'c.d': 1 }]);
  });

  it('resolves_the_new_name_for_each_item', async () => {
    const result = await rename({
      pairs: [
        {
          from: fixed('user_name'),
          to: formula('{{ $json.user_name }}_name'),
        },
      ],
    });
    expect(result.main).toEqual([
      { ada_name: 'ada', user_email: 'ada@shop.test', meta: { sku: 'K-1' } },
      { bob_name: 'bob', meta: { sku: 'L-1' } },
    ]);
  });

  it('does_not_change_the_input_items', async () => {
    await rename({
      pairs: [{ from: fixed('meta.sku'), to: fixed('sku') }],
    });
    expect(items[0]).toEqual({
      user_name: 'ada',
      user_email: 'ada@shop.test',
      meta: { sku: 'K-1' },
    });
  });

  it('renames_every_top_level_key_by_a_regular_expression_with_groups_keeping_their_order', async () => {
    const result = await rename({
      mode: fixed('regex'),
      pattern: fixed('^user_(.*)$'),
      replacement: fixed('$1_field'),
    });
    expect(result.main).toEqual([
      { name_field: 'ada', email_field: 'ada@shop.test', meta: { sku: 'K-1' } },
      { name_field: 'bob', meta: { sku: 'L-1' } },
    ]);
    expect(Object.keys(result.main![0]!)).toEqual([
      'name_field',
      'email_field',
      'meta',
    ]);
  });

  it('removes_the_matched_text_when_no_replacement_is_given', async () => {
    const result = await rename({
      mode: fixed('regex'),
      pattern: fixed('^user_'),
    });
    expect(result.main?.[0]).toEqual({
      name: 'ada',
      email: 'ada@shop.test',
      meta: { sku: 'K-1' },
    });
  });

  it('a_pattern_outside_the_linear_time_syntax_is_refused_by_the_schema', () => {
    const result = new RenameKeysNode().parameters.safeParse({
      mode: 'regex',
      pattern: '(a)\\1',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['pattern'],
      params: { problem: ProblemCode.InvalidRegex },
    });
  });

  it('the_regex_mode_without_a_pattern_is_refused_by_the_schema', () => {
    const result = new RenameKeysNode().parameters.safeParse({
      mode: 'regex',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ['pattern'] });
  });

  it('accepts_the_mode_only_as_a_fixed_value', () => {
    expect(new RenameKeysNode().fixedParameters).toEqual(['mode']);
  });
});
