import { DateTime } from 'luxon';
import { ParameterError } from '../../../src/interface-adapters/node-types/parameters/parameter-error.js';
import { ParameterTree } from '../../../src/interface-adapters/node-types/parameters/parameter-tree.js';
import { ResolutionContext } from '../../../src/interface-adapters/node-types/parameters/resolution-context.js';

const context = (itemIndex = 1) =>
  new ResolutionContext({
    item: { name: 'kibble', price: 10, address: { city: 'Kyiv' } },
    itemIndex,
    input: [{ name: 'first' }, { name: 'kibble', price: 10 }],
    upstream: [
      { nodeId: 'fetch-id', name: 'Fetch', items: [{ id: 1 }, { id: 2 }] },
    ],
    now: DateTime.fromISO('2026-10-16T10:00:00.000Z'),
    timezone: 'UTC',
    execution: {
      id: 'run-1',
      mode: 'test',
      startedAt: '2026-10-16T10:00:00.000Z',
    },
    workflow: { id: 'wf-1', name: 'Orders', version: null },
  });

describe('ParameterTree', () => {
  it('a_parameter_named_proto_stays_an_own_key_and_never_changes_the_prototype', () => {
    const tree = ParameterTree.parse(
      JSON.parse('{"__proto__": {"methods": {"fixed": ["GET"]}}}') as Record<
        string,
        unknown
      >,
    );

    for (const value of [tree.resolve(context()), tree.sketch()]) {
      expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
      expect(Object.hasOwn(value, '__proto__')).toBe(true);
      expect((value as { methods?: unknown }).methods).toBeUndefined();
    }
  });

  it('fixed_values_resolve_to_themselves_inside_groups_and_lists', () => {
    const tree = ParameterTree.parse({
      mode: { fixed: 'manual' },
      fields: [
        { name: { fixed: 'total' }, value: { fixed: 3 } },
        { name: { fixed: 'tags' }, value: { fixed: ['a', 'b'] } },
      ],
    });
    expect(tree.resolve(context())).toEqual({
      mode: 'manual',
      fields: [
        { name: 'total', value: 3 },
        { name: 'tags', value: ['a', 'b'] },
      ],
    });
  });

  it('a_field_reference_reads_the_current_item_or_the_same_position_item_of_an_upstream_node', () => {
    const tree = ParameterTree.parse({
      city: { ref: { node: '$item', path: 'address.city' } },
      whole: { ref: { node: '$item', path: '' } },
      id: { ref: { node: 'fetch-id', path: 'id' } },
      missing: { ref: { node: '$item', path: 'address.street.name' } },
      notRun: { ref: { node: 'never-ran', path: 'id' } },
    });
    expect(tree.resolve(context())).toEqual({
      city: 'Kyiv',
      whole: { name: 'kibble', price: 10, address: { city: 'Kyiv' } },
      id: 2,
      missing: undefined,
      notRun: undefined,
    });
  });

  it('a_formula_is_evaluated_for_the_current_item', () => {
    const tree = ParameterTree.parse({
      total: { formula: '{{ $json.price * 2 }}' },
      label: { formula: "{{ $('Fetch').item.json.id }}-{{ $json.name }}" },
    });
    expect(tree.resolve(context())).toEqual({ total: 20, label: '2-kibble' });
  });

  it('a_formula_that_cannot_be_evaluated_names_its_parameter', () => {
    const tree = ParameterTree.parse({
      list: [{ value: { formula: '{{ $json.missing.deeper }}' } }],
    });
    let error: unknown;
    try {
      tree.resolve(context());
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ParameterError);
    expect((error as ParameterError).parameter).toBe('list.0.value');
    expect((error as ParameterError).limit).toBe(false);
  });

  it('the_sketch_keeps_fixed_values_and_leaves_dynamic_values_empty', () => {
    const tree = ParameterTree.parse({
      a: { fixed: 1 },
      b: { formula: '{{ 1 + 1 }}' },
      c: [{ d: { ref: { node: '$item', path: 'x' } } }],
    });
    expect(tree.sketch()).toEqual({
      a: 1,
      b: undefined,
      c: [{ d: undefined }],
    });
    expect(tree.dynamicPaths).toEqual(['b', 'c.0.d']);
  });

  it('a_value_that_is_not_a_binding_is_reported_with_its_path', () => {
    const tree = ParameterTree.parse({
      plain: 5,
      both: { fixed: 1, formula: '{{ 1 }}' },
      badRef: { ref: { node: 7 } },
      fine: { fixed: 'ok' },
    });
    expect(tree.malformed.map((value) => value.path)).toEqual([
      'plain',
      'both',
      'badRef',
    ]);
  });

  it('formulas_are_listed_with_their_paths_and_syntax_problems', () => {
    const tree = ParameterTree.parse({
      ok: { formula: '{{ $json.a }}' },
      broken: { formula: '{{ $json. }}' },
      unknown: { formula: '{{ secret }}' },
    });
    expect(
      tree.formulas.map((formula) => [
        formula.path,
        formula.error?.code ?? null,
      ]),
    ).toEqual([
      ['ok', null],
      ['broken', 'syntax'],
      ['unknown', 'scope'],
    ]);
  });

  it('renaming_a_node_rewrites_the_formulas_that_name_it_and_nothing_else', () => {
    const tree = ParameterTree.parse({
      a: { formula: "{{ $('Old').item.json.x }}" },
      b: [{ c: { fixed: "$('Old')" } }],
    });
    expect(tree.renameNodes(new Map([['Old', 'New']]))).toEqual({
      a: { formula: "{{ $('New').item.json.x }}" },
      b: [{ c: { fixed: "$('Old')" } }],
    });
  });
});
