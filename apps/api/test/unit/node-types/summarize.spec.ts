import { SummarizeNode } from '../../../src/interface-adapters/node-types/types/summarize.node.js';
import { fixed, runNode } from '../../support/node-runs.js';

const sales = [
  { region: 'north', product: 'kibble', amount: 10, customer: 'ada' },
  { region: 'south', product: 'litter', amount: '25', customer: 'bob' },
  { region: 'north', product: 'toy', amount: 4, customer: 'ada' },
  { region: 'north', product: 'kibble', amount: null, customer: 'cy' },
  { region: 'south', product: 'toy', customer: 'bob' },
];

const aggregation = (operation: string, field: string) => ({
  operation: fixed(operation),
  field: fixed(field),
});

const summarize = (parameters: Record<string, unknown>) =>
  runNode(new SummarizeNode(), { items: sales, parameters });

describe('Summarize', () => {
  it('without_group_fields_summarizes_all_items_into_one', async () => {
    const result = await summarize({
      aggregations: [aggregation('count', 'product')],
    });
    expect(result.main).toEqual([{ count_product: 5 }]);
  });

  it('groups_items_by_the_group_fields_in_order_of_first_appearance', async () => {
    const result = await summarize({
      groupBy: [fixed('region')],
      aggregations: [aggregation('count', 'product')],
    });
    expect(result.main).toEqual([
      { region: 'north', count_product: 3 },
      { region: 'south', count_product: 2 },
    ]);
  });

  it('groups_by_the_combination_of_several_fields', async () => {
    const result = await summarize({
      groupBy: [fixed('region'), fixed('product')],
      aggregations: [aggregation('count', 'customer')],
    });
    expect(result.main).toEqual([
      { region: 'north', product: 'kibble', count_customer: 2 },
      { region: 'south', product: 'litter', count_customer: 1 },
      { region: 'north', product: 'toy', count_customer: 1 },
      { region: 'south', product: 'toy', count_customer: 1 },
    ]);
  });

  it('writes_nested_group_fields_by_path_and_names_nested_aggregations_with_underscores', async () => {
    const result = await runNode(new SummarizeNode(), {
      items: [
        { shop: { city: 'kyiv' }, order: { total: 5 } },
        { shop: { city: 'kyiv' }, order: { total: 7 } },
      ],
      parameters: {
        groupBy: [fixed('shop.city')],
        aggregations: [aggregation('sum', 'order.total')],
      },
    });
    expect(result.main).toEqual([
      { shop: { city: 'kyiv' }, sum_order_total: 12 },
    ]);
  });

  it('groups_items_missing_a_group_field_with_those_where_it_is_null', async () => {
    const result = await runNode(new SummarizeNode(), {
      items: [{ region: 'north', n: 1 }, { n: 2 }, { region: null, n: 3 }],
      parameters: {
        groupBy: [fixed('region')],
        aggregations: [aggregation('sum', 'n')],
      },
    });
    expect(result.main).toEqual([
      { region: 'north', sum_n: 1 },
      { region: null, sum_n: 5 },
    ]);
  });

  it('groups_objects_equal_whatever_their_key_order', async () => {
    const result = await runNode(new SummarizeNode(), {
      items: [{ size: { w: 1, h: 2 } }, { size: { h: 2, w: 1 } }],
      parameters: {
        groupBy: [fixed('size')],
        aggregations: [aggregation('count', 'size')],
      },
    });
    expect(result.main).toEqual([{ size: { w: 1, h: 2 }, count_size: 2 }]);
  });

  it('counts_the_values_that_are_present', async () => {
    const result = await summarize({
      aggregations: [aggregation('count', 'amount')],
    });
    expect(result.main).toEqual([{ count_amount: 3 }]);
  });

  it('counts_distinct_present_values', async () => {
    const result = await runNode(new SummarizeNode(), {
      items: [
        { tag: { a: 1, b: 2 } },
        { tag: { b: 2, a: 1 } },
        { tag: 'x' },
        { tag: null },
        {},
      ],
      parameters: { aggregations: [aggregation('countUnique', 'tag')] },
    });
    expect(result.main).toEqual([{ countUnique_tag: 2 }]);
  });

  it('sums_numbers_and_numeric_strings', async () => {
    const result = await summarize({
      aggregations: [aggregation('sum', 'amount')],
    });
    expect(result.main).toEqual([{ sum_amount: 39 }]);
  });

  it('averages_numbers_and_numeric_strings', async () => {
    const result = await summarize({
      aggregations: [aggregation('average', 'amount')],
    });
    expect(result.main).toEqual([{ average_amount: 13 }]);
  });

  it('takes_the_smallest_and_the_largest_number', async () => {
    const result = await summarize({
      aggregations: [
        aggregation('min', 'amount'),
        aggregation('max', 'amount'),
      ],
    });
    expect(result.main).toEqual([{ min_amount: 4, max_amount: 25 }]);
  });

  it('without_numbers_the_sum_is_zero_and_the_average_min_and_max_are_null', async () => {
    const result = await summarize({
      aggregations: [
        aggregation('sum', 'customer'),
        aggregation('average', 'customer'),
        aggregation('min', 'customer'),
        aggregation('max', 'customer'),
      ],
    });
    expect(result.main).toEqual([
      {
        sum_customer: 0,
        average_customer: null,
        min_customer: null,
        max_customer: null,
      },
    ]);
  });

  it('appends_the_present_values_into_a_list', async () => {
    const result = await summarize({
      aggregations: [aggregation('append', 'amount')],
    });
    expect(result.main).toEqual([{ append_amount: [10, '25', 4] }]);
  });

  it('concatenates_the_text_of_the_present_values_with_a_comma_by_default', async () => {
    const result = await summarize({
      aggregations: [aggregation('concatenate', 'amount')],
    });
    expect(result.main).toEqual([{ concatenate_amount: '10, 25, 4' }]);
  });

  it('concatenates_with_the_chosen_separator', async () => {
    const result = await summarize({
      groupBy: [fixed('region')],
      aggregations: [
        {
          operation: fixed('concatenate'),
          field: fixed('product'),
          separator: fixed(' + '),
        },
      ],
    });
    expect(result.main).toEqual([
      { region: 'north', concatenate_product: 'kibble + toy + kibble' },
      { region: 'south', concatenate_product: 'litter + toy' },
    ]);
  });

  it('requires_at_least_one_aggregation', async () => {
    await expect(summarize({ aggregations: [] })).rejects.toMatchObject({
      parameter: 'aggregations',
    });
  });

  it('produces_no_items_without_input_items', async () => {
    const result = await runNode(new SummarizeNode(), {
      items: [],
      parameters: { aggregations: [aggregation('count', 'product')] },
    });
    expect(result).toEqual({ main: [] });
  });
});
