import { NodeUserError } from '../../../src/interface-adapters/node-types/node-user-error.js';
import { SortNode } from '../../../src/interface-adapters/node-types/types/sort.node.js';
import { fixed, runNode } from '../../support/node-runs.js';

const products = [
  { name: 'kibble', price: 10, stock: true },
  { name: 'Litter', price: 25, stock: false },
  { name: 'toy', price: 3, stock: true },
  { name: 'apple', price: 10, stock: false },
];

const [kibble, litter, toy, apple] = products;

const by = (name: string, order?: string) =>
  order === undefined
    ? { field: fixed(name) }
    : { field: fixed(name), order: fixed(order) };

const sort = (
  parameters: Record<string, unknown>,
  items: readonly Record<string, unknown>[] = products,
) => runNode(new SortNode(), { items, parameters });

describe('Sort', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sorts_numbers_ascending_by_default', async () => {
    const result = await sort({ fields: [by('price')] });
    expect(result.main).toEqual([toy, kibble, apple, litter]);
  });

  it('sorts_descending_when_asked', async () => {
    const result = await sort({ fields: [by('price', 'descending')] });
    expect(result.main).toEqual([litter, kibble, apple, toy]);
  });

  it('keeps_the_input_order_of_items_with_equal_values', async () => {
    const result = await sort({ fields: [by('stock')] });
    expect(result.main).toEqual([litter, apple, kibble, toy]);
  });

  it('sorts_strings_by_locale', async () => {
    const result = await sort({ fields: [by('name')] });
    expect(result.main).toEqual([apple, kibble, litter, toy]);
  });

  it('breaks_ties_by_the_next_field', async () => {
    const result = await sort({ fields: [by('price'), by('name')] });
    expect(result.main).toEqual([toy, apple, kibble, litter]);
  });

  it('sorts_by_nested_fields', async () => {
    const result = await sort({ fields: [by('meta.rank')] }, [
      { meta: { rank: 2 } },
      { meta: { rank: 1 } },
    ]);
    expect(result.main).toEqual([{ meta: { rank: 1 } }, { meta: { rank: 2 } }]);
  });

  it('puts_missing_and_null_values_last_whatever_the_order', async () => {
    const items = [{ n: 2 }, { n: null }, {}, { n: 5 }];
    expect((await sort({ fields: [by('n')] }, items)).main).toEqual([
      { n: 2 },
      { n: 5 },
      { n: null },
      {},
    ]);
    expect(
      (await sort({ fields: [by('n', 'descending')] }, items)).main,
    ).toEqual([{ n: 5 }, { n: 2 }, { n: null }, {}]);
  });

  it('orders_mixed_types_numbers_then_strings_then_booleans_then_others', async () => {
    const result = await sort({ fields: [by('v')] }, [
      { v: [1] },
      { v: true },
      { v: 'a' },
      { v: 2 },
    ]);
    expect(result.main).toEqual([
      { v: 2 },
      { v: 'a' },
      { v: true },
      { v: [1] },
    ]);
  });

  it('does_not_change_the_input_items', async () => {
    await sort({ fields: [by('price')] });
    expect(products).toEqual([kibble, litter, toy, apple]);
  });

  it('the_fields_mode_without_fields_fails_the_node_on_the_fields_parameter', async () => {
    const result = sort({});
    await expect(result).rejects.toBeInstanceOf(NodeUserError);
    await expect(result).rejects.toMatchObject({ parameter: 'fields' });
  });

  it('the_random_mode_returns_a_permutation_of_the_items', async () => {
    const result = await sort({ mode: fixed('random') });
    expect(result.main).toHaveLength(4);
    expect(result.main).toEqual(expect.arrayContaining(products));
  });

  it('the_random_mode_shuffles_with_fisher_yates', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = await sort({ mode: fixed('random') });
    expect(result.main).toEqual([litter, toy, apple, kibble]);
  });
});
