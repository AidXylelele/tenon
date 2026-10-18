import { ItemPath } from '../../../src/interface-adapters/node-types/item-path.js';
import { NodeUserError } from '../../../src/interface-adapters/node-types/node-user-error.js';
import { EditFieldsNode } from '../../../src/interface-adapters/node-types/types/edit-fields.node.js';
import { field, fixed, formula, runNode } from '../../support/node-runs.js';

const items = [
  { name: 'kibble', price: 10, meta: { sku: 'K-1', stock: 3 } },
  { name: 'litter', price: 25, meta: { sku: 'L-1', stock: 0 } },
];

const edit = (parameters: Record<string, unknown>) =>
  runNode(new EditFieldsNode(), { items, parameters });

describe('ItemPath', () => {
  it('reads_writes_and_removes_nested_fields_by_dot_path_without_touching_the_original', () => {
    const item = { a: { b: 1 } };
    const path = new ItemPath('a.c.d', true);
    const written = path.write(item, 5);
    expect(written).toEqual({ a: { b: 1, c: { d: 5 } } });
    expect(item).toEqual({ a: { b: 1 } });
    expect(new ItemPath('a.b', true).read(written)).toBe(1);
    expect(new ItemPath('a.b', true).remove(written)).toEqual({
      a: { c: { d: 5 } },
    });
  });

  it('a_path_through_the_prototype_is_refused_and_leaves_object_prototype_alone', () => {
    for (const path of [
      '__proto__.polluted',
      'constructor.prototype.polluted',
      'a.__proto__',
    ]) {
      expect(() => new ItemPath(path, true).write({ a: {} }, 'x')).toThrow(
        NodeUserError,
      );
    }

    expect(() =>
      new ItemPath('__proto__.toLocaleString', true).remove({}),
    ).toThrow(NodeUserError);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(typeof Object.prototype.toLocaleString).toBe('function');
  });

  it('writing_through_an_inherited_name_creates_an_own_field', () => {
    const written = new ItemPath('toString.x', true).write({}, 1);
    expect(written).toEqual({ toString: { x: 1 } });
    expect(Object.hasOwn(written, 'toString')).toBe(true);
  });

  it('without_dot_notation_the_whole_name_is_one_key', () => {
    expect(new ItemPath('a.b', false).write({}, 1)).toEqual({ 'a.b': 1 });
  });
});

describe('Edit Fields', () => {
  it('sets_fields_from_fixed_values_references_and_formulas_and_keeps_the_others', async () => {
    const result = await edit({
      assignments: [
        { name: fixed('total'), value: formula('{{ $json.price * 2 }}') },
        { name: fixed('meta.label'), value: field('name') },
        { name: fixed('source'), value: fixed('shop') },
      ],
    });
    expect(result.main).toEqual([
      {
        name: 'kibble',
        price: 10,
        meta: { sku: 'K-1', stock: 3, label: 'kibble' },
        total: 20,
        source: 'shop',
      },
      {
        name: 'litter',
        price: 25,
        meta: { sku: 'L-1', stock: 0, label: 'litter' },
        total: 50,
        source: 'shop',
      },
    ]);
  });

  it('keeps_none_selected_or_all_but_selected_other_fields', async () => {
    const assign = [{ name: fixed('flag'), value: fixed(true) }];
    expect(
      (await edit({ assignments: assign, include: fixed('none') })).main,
    ).toEqual([{ flag: true }, { flag: true }]);
    expect(
      (
        await edit({
          assignments: assign,
          include: fixed('selected'),
          fields: [fixed('name'), fixed('meta.sku')],
        })
      ).main?.[0],
    ).toEqual({ name: 'kibble', meta: { sku: 'K-1' }, flag: true });
    expect(
      (
        await edit({
          assignments: [],
          include: fixed('except'),
          fields: [fixed('meta')],
        })
      ).main?.[1],
    ).toEqual({ name: 'litter', price: 25 });
  });

  it('merges_a_json_template_into_each_item', async () => {
    const result = await edit({
      mode: fixed('json'),
      json: formula('{{ { "label": $json.name.toUpperCase(), "price": 1 } }}'),
    });
    expect(result.main?.[0]).toMatchObject({ label: 'KIBBLE', price: 1 });
  });

  it('a_json_template_that_is_not_an_object_fails_the_node_with_the_parameter', async () => {
    await expect(
      edit({ mode: fixed('json'), json: fixed('[1, 2]') }),
    ).rejects.toMatchObject({ parameter: 'json', item: 0 });
    await expect(
      edit({ mode: fixed('json'), json: fixed('{ broken') }),
    ).rejects.toBeInstanceOf(NodeUserError);
  });
});

describe('Edit Fields and reserved names', () => {
  it('a_field_name_that_reaches_the_prototype_fails_the_node_without_polluting_it', async () => {
    await expect(
      edit({
        assignments: [
          { name: formula('{{ "__proto__.polluted" }}'), value: fixed('yes') },
        ],
      }),
    ).rejects.toBeInstanceOf(NodeUserError);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});
