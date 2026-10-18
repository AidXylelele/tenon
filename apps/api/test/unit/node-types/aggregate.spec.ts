import { AggregateNode } from '../../../src/interface-adapters/node-types/types/aggregate.node.js';
import { fixed, runNode } from '../../support/node-runs.js';

const items = [
  { name: 'kibble', price: 10, meta: { sku: 'K-1' } },
  { name: 'litter', meta: { sku: 'L-1' } },
  { name: 'toy', price: 3, meta: { sku: 'T-1' } },
];

const aggregate = (parameters: Record<string, unknown>) =>
  runNode(new AggregateNode(), { items, parameters });

describe('Aggregate', () => {
  it('collects_each_field_across_all_items_into_one_item_skipping_missing_values', async () => {
    const result = await aggregate({
      fields: [{ field: fixed('name') }, { field: fixed('price') }],
    });
    expect(result.main).toEqual([
      { name: ['kibble', 'litter', 'toy'], price: [10, 3] },
    ]);
  });

  it('names_a_nested_field_by_its_last_segment', async () => {
    const result = await aggregate({ fields: [{ field: fixed('meta.sku') }] });
    expect(result.main).toEqual([{ sku: ['K-1', 'L-1', 'T-1'] }]);
  });

  it('names_a_field_by_its_rename_when_given', async () => {
    const result = await aggregate({
      fields: [{ field: fixed('name'), rename: fixed('products') }],
    });
    expect(result.main).toEqual([{ products: ['kibble', 'litter', 'toy'] }]);
  });

  it('keeps_missing_values_as_null_when_asked', async () => {
    const result = await aggregate({
      fields: [{ field: fixed('price') }],
      keepMissing: fixed(true),
    });
    expect(result.main).toEqual([{ price: [10, null, 3] }]);
  });

  it('without_fields_produces_one_empty_item', async () => {
    expect((await aggregate({})).main).toEqual([{}]);
  });

  it('collects_all_items_into_the_data_field_by_default', async () => {
    const result = await aggregate({ mode: fixed('allData') });
    expect(result.main).toEqual([{ data: items }]);
  });

  it('collects_all_items_into_the_chosen_destination', async () => {
    const result = await aggregate({
      mode: fixed('allData'),
      destination: fixed('orders'),
    });
    expect(result.main).toEqual([{ orders: items }]);
  });

  it('produces_no_items_without_input_items', async () => {
    const result = await runNode(new AggregateNode(), {
      items: [],
      parameters: { fields: [{ field: fixed('name') }] },
    });
    expect(result).toEqual({ main: [] });
  });
});
