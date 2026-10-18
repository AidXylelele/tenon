import { FieldShapes } from '../../../src/interface-adapters/node-types/field-shapes.js';
import { ParameterFormulaEngine } from '../../../src/interface-adapters/node-types/parameter-formula.engine.js';

describe('FieldShapes', () => {
  it('lists_every_path_and_type_seen_in_the_items_in_dot_notation', () => {
    expect(
      FieldShapes.of([
        { name: 'a', address: { city: 'Kyiv' }, tags: ['x'], none: null },
        { name: 'b', price: 3, active: true },
      ]),
    ).toEqual([
      { path: 'name', type: 'string' },
      { path: 'address', type: 'object' },
      { path: 'address.city', type: 'string' },
      { path: 'tags', type: 'array' },
      { path: 'none', type: 'null' },
      { path: 'price', type: 'number' },
      { path: 'active', type: 'boolean' },
    ]);
  });

  it('reads_only_the_first_twenty_items_and_at_most_five_hundred_paths', () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      [`f${index}`]: index,
    }));
    expect(FieldShapes.of(items)).toHaveLength(20);
    const wide = Object.fromEntries(
      Array.from({ length: 600 }, (_, index) => [`k${index}`, index]),
    );
    expect(FieldShapes.of([wide])).toHaveLength(500);
  });
});

describe('ParameterFormulaEngine', () => {
  it('renaming_a_node_rewrites_the_formulas_of_the_parameters', () => {
    expect(
      new ParameterFormulaEngine().renameNodes(
        { a: { formula: "{{ $('Old').item.json.x }}" }, b: { fixed: 1 } },
        [{ from: 'Old', to: 'New' }],
      ),
    ).toEqual({
      a: { formula: "{{ $('New').item.json.x }}" },
      b: { fixed: 1 },
    });
  });
});
