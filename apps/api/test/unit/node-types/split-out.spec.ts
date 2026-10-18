import { SplitOutNode } from '../../../src/interface-adapters/node-types/types/split-out.node.js';
import { field, fixed, runNode } from '../../support/node-runs.js';

const orders = [
  {
    id: 1,
    customer: 'ada',
    lines: [
      { sku: 'K-1', qty: 2 },
      { sku: 'L-1', qty: 1 },
    ],
  },
  { id: 2, customer: 'bob', lines: [{ sku: 'T-1', qty: 5 }] },
];

const split = (parameters: Record<string, unknown>) =>
  runNode(new SplitOutNode(), { items: orders, parameters });

describe('Split Out', () => {
  it('turns_each_object_of_the_list_into_an_item', async () => {
    const result = await split({ field: fixed('lines') });
    expect(result.main).toEqual([
      { sku: 'K-1', qty: 2 },
      { sku: 'L-1', qty: 1 },
      { sku: 'T-1', qty: 5 },
    ]);
  });

  it('wraps_values_that_are_not_objects_in_a_field_named_by_the_last_segment', async () => {
    const result = await runNode(new SplitOutNode(), {
      items: [{ order: { tags: ['new', ['gift']] } }],
      parameters: { field: fixed('order.tags') },
    });
    expect(result.main).toEqual([{ tags: 'new' }, { tags: ['gift'] }]);
  });

  it('puts_every_element_in_the_destination_field_when_one_is_set', async () => {
    const result = await split({
      field: fixed('lines'),
      destination: fixed('line'),
    });
    expect(result.main).toEqual([
      { line: { sku: 'K-1', qty: 2 } },
      { line: { sku: 'L-1', qty: 1 } },
      { line: { sku: 'T-1', qty: 5 } },
    ]);
  });

  it('treats_a_value_that_is_not_a_list_as_a_list_of_one', async () => {
    const result = await runNode(new SplitOutNode(), {
      items: [{ id: 1, tag: 'new' }],
      parameters: { field: fixed('tag') },
    });
    expect(result.main).toEqual([{ tag: 'new' }]);
  });

  it('an_item_without_the_field_produces_nothing', async () => {
    const result = await runNode(new SplitOutNode(), {
      items: [{ id: 3 }, orders[1]!],
      parameters: { field: fixed('lines') },
    });
    expect(result.main).toEqual([{ sku: 'T-1', qty: 5 }]);
  });

  it('adds_every_other_field_of_the_source_item', async () => {
    const result = await split({
      field: fixed('lines'),
      include: fixed('allOther'),
    });
    expect(result.main).toEqual([
      { id: 1, customer: 'ada', sku: 'K-1', qty: 2 },
      { id: 1, customer: 'ada', sku: 'L-1', qty: 1 },
      { id: 2, customer: 'bob', sku: 'T-1', qty: 5 },
    ]);
  });

  it('adds_only_the_selected_fields_of_the_source_item', async () => {
    const result = await split({
      field: fixed('lines'),
      include: fixed('selected'),
      fields: [fixed('customer')],
    });
    expect(result.main).toEqual([
      { customer: 'ada', sku: 'K-1', qty: 2 },
      { customer: 'ada', sku: 'L-1', qty: 1 },
      { customer: 'bob', sku: 'T-1', qty: 5 },
    ]);
  });

  it('element_fields_win_over_added_fields', async () => {
    const result = await runNode(new SplitOutNode(), {
      items: [{ id: 1, status: 'open', lines: [{ id: 'L-1' }] }],
      parameters: { field: fixed('lines'), include: fixed('allOther') },
    });
    expect(result.main).toEqual([{ id: 'L-1', status: 'open' }]);
  });

  it('resolves_the_field_for_each_item', async () => {
    const result = await runNode(new SplitOutNode(), {
      items: [
        { list: 'a', a: [{ n: 1 }, { n: 2 }] },
        { list: 'b', b: [{ n: 3 }] },
      ],
      parameters: { field: field('list') },
    });
    expect(result.main).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });

  it('does_not_change_the_input_items', async () => {
    await split({ field: fixed('lines'), include: fixed('allOther') });
    expect(orders[1]).toEqual({
      id: 2,
      customer: 'bob',
      lines: [{ sku: 'T-1', qty: 5 }],
    });
  });
});
