import type { Item } from '../../../src/application/interfaces.js';
import { MergeNode } from '../../../src/interface-adapters/node-types/types/merge.node.js';
import { NodeLimitError } from '../../../src/interface-adapters/node-types/node-limit-error.js';
import { NodeUserError } from '../../../src/interface-adapters/node-types/node-user-error.js';
import { fixed, runNode } from '../../support/node-runs.js';

const orders = [
  { id: 1, total: 10 },
  { id: 2, total: 25 },
  { id: 3, total: 5 },
];

const customers = [
  { id: 2, name: 'Ann' },
  { id: 1, name: 'Bob' },
  { id: 1, name: 'Bea' },
  { id: 4, name: 'Eve' },
];

const merge = (
  parameters: Record<string, unknown>,
  inputs: Record<string, readonly Item[]>,
) => runNode(new MergeNode(), { parameters, inputs });

const byId = (join: string, inputs: Record<string, readonly Item[]>) =>
  merge(
    {
      mode: fixed('combineByFields'),
      fields: [{ field1: fixed('id'), field2: fixed('id') }],
      join: fixed(join),
    },
    inputs,
  );

const byPosition = (
  parameters: Record<string, unknown>,
  inputs: Record<string, readonly Item[]>,
) => merge({ mode: fixed('combineByPosition'), ...parameters }, inputs);

describe('Merge', () => {
  describe('append', () => {
    it('appends_the_items_of_every_input_in_input_order', async () => {
      const result = await merge(
        {},
        {
          input1: [{ n: 1 }],
          input2: [{ n: 2 }, { n: 3 }],
          input3: [{ n: 4 }],
          input4: [{ n: 5 }],
        },
      );
      expect(result).toEqual({
        main: [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }, { n: 5 }],
      });
    });

    it('appends_the_other_inputs_when_an_input_is_empty', async () => {
      const result = await merge(
        { mode: fixed('append') },
        { input1: [], input2: [{ n: 2 }], input3: [], input4: [{ n: 4 }] },
      );
      expect(result).toEqual({ main: [{ n: 2 }, { n: 4 }] });
    });
  });

  describe('combine by fields', () => {
    it('keeps_one_merged_item_per_matching_pair_in_input1_then_input2_order', async () => {
      const result = await byId('keepMatches', {
        input1: orders,
        input2: customers,
      });
      expect(result.main).toEqual([
        { id: 1, total: 10, name: 'Bob' },
        { id: 1, total: 10, name: 'Bea' },
        { id: 2, total: 25, name: 'Ann' },
      ]);
    });

    it('keeps_matches_by_default', async () => {
      const result = await merge(
        {
          mode: fixed('combineByFields'),
          fields: [{ field1: fixed('id'), field2: fixed('id') }],
        },
        { input1: [orders[1]!], input2: customers },
      );
      expect(result.main).toEqual([{ id: 2, total: 25, name: 'Ann' }]);
    });

    it('matches_only_when_every_pair_of_fields_is_equal', async () => {
      const result = await merge(
        {
          mode: fixed('combineByFields'),
          fields: [
            { field1: fixed('id'), field2: fixed('orderId') },
            { field1: fixed('shop'), field2: fixed('store') },
          ],
        },
        {
          input1: [
            { id: 1, shop: 'north' },
            { id: 2, shop: 'south' },
          ],
          input2: [
            { orderId: 1, store: 'south', paid: true },
            { orderId: 2, store: 'south', paid: false },
          ],
        },
      );
      expect(result.main).toEqual([
        { id: 2, shop: 'south', orderId: 2, store: 'south', paid: false },
      ]);
    });

    it('reads_nested_fields_by_dot_path_and_compares_values_deeply', async () => {
      const result = await merge(
        {
          mode: fixed('combineByFields'),
          fields: [{ field1: fixed('customer.key'), field2: fixed('key') }],
        },
        {
          input1: [{ customer: { key: { region: 'eu', number: 7 } } }],
          input2: [{ key: { number: 7, region: 'eu' }, name: 'Ann' }],
        },
      );
      expect(result.main).toEqual([
        {
          customer: { key: { region: 'eu', number: 7 } },
          key: { number: 7, region: 'eu' },
          name: 'Ann',
        },
      ]);
    });

    it('never_matches_items_that_both_miss_a_field', async () => {
      const result = await byId('keepMatches', {
        input1: [{ total: 10 }],
        input2: [{ name: 'Ann' }],
      });
      expect(result.main).toEqual([]);
    });

    it('keep_non_matches_outputs_unmatched_items_of_input1_then_of_input2', async () => {
      const result = await byId('keepNonMatches', {
        input1: orders,
        input2: customers,
      });
      expect(result.main).toEqual([
        { id: 3, total: 5 },
        { id: 4, name: 'Eve' },
      ]);
    });

    it('keep_everything_outputs_the_matches_then_the_unmatched_items_of_each_input', async () => {
      const result = await byId('keepEverything', {
        input1: orders,
        input2: customers,
      });
      expect(result.main).toEqual([
        { id: 1, total: 10, name: 'Bob' },
        { id: 1, total: 10, name: 'Bea' },
        { id: 2, total: 25, name: 'Ann' },
        { id: 3, total: 5 },
        { id: 4, name: 'Eve' },
      ]);
    });

    it('enrich_input1_outputs_every_input1_item_merged_with_its_first_match', async () => {
      const result = await byId('enrichInput1', {
        input1: orders,
        input2: customers,
      });
      expect(result.main).toEqual([
        { id: 1, total: 10, name: 'Bob' },
        { id: 2, total: 25, name: 'Ann' },
        { id: 3, total: 5 },
      ]);
    });

    it('enrich_input2_outputs_every_input2_item_merged_with_its_first_match', async () => {
      const result = await byId('enrichInput2', {
        input1: orders,
        input2: customers,
      });
      expect(result.main).toEqual([
        { id: 2, total: 25, name: 'Ann' },
        { id: 1, total: 10, name: 'Bob' },
        { id: 1, total: 10, name: 'Bea' },
        { id: 4, name: 'Eve' },
      ]);
    });

    it('keep_matches_outputs_nothing_when_an_input_is_empty', async () => {
      const result = await byId('keepMatches', {
        input1: orders,
        input2: [],
      });
      expect(result).toEqual({ main: [] });
    });

    it('enrich_modes_output_their_own_side_when_the_other_input_is_empty', async () => {
      const first = await byId('enrichInput1', {
        input1: orders,
        input2: [],
      });
      const second = await byId('enrichInput2', {
        input1: [],
        input2: customers,
      });
      expect(first.main).toEqual(orders);
      expect(second.main).toEqual(customers);
    });

    it('without_fields_to_match_fails_the_node_with_the_parameter', async () => {
      const failure = merge(
        { mode: fixed('combineByFields') },
        { input1: orders, input2: customers },
      );
      await expect(failure).rejects.toBeInstanceOf(NodeUserError);
      await expect(failure).rejects.toMatchObject({ parameter: 'fields' });
    });
  });

  describe('field clashes', () => {
    const inputs = {
      input1: [{ id: 1, status: 'new', note: 'gift' }],
      input2: [{ id: 1, status: 'paid', paidAt: '2026-10-16' }],
    };

    it('prefers_input2_values_by_default', async () => {
      const result = await byPosition({}, inputs);
      expect(result.main).toEqual([
        { id: 1, status: 'paid', note: 'gift', paidAt: '2026-10-16' },
      ]);
    });

    it('prefers_input1_values_when_asked', async () => {
      const result = await byPosition({ clash: fixed('preferInput1') }, inputs);
      expect(result.main).toEqual([
        { id: 1, status: 'new', note: 'gift', paidAt: '2026-10-16' },
      ]);
    });

    it('adds_input_suffixes_to_fields_present_in_both_when_asked', async () => {
      const result = await byPosition({ clash: fixed('addSuffix') }, inputs);
      expect(result.main).toEqual([
        {
          id_1: 1,
          status_1: 'new',
          note: 'gift',
          id_2: 1,
          status_2: 'paid',
          paidAt: '2026-10-16',
        },
      ]);
    });

    it('leaves_the_input_items_unchanged', async () => {
      await byPosition({ clash: fixed('addSuffix') }, inputs);
      expect(inputs).toEqual({
        input1: [{ id: 1, status: 'new', note: 'gift' }],
        input2: [{ id: 1, status: 'paid', paidAt: '2026-10-16' }],
      });
    });
  });

  describe('combine by position', () => {
    const inputs = {
      input1: [{ a: 1 }, { a: 2 }, { a: 3 }],
      input2: [{ b: 1 }, { b: 2 }],
    };

    it('merges_items_with_the_same_index_and_drops_the_unpaired_ones', async () => {
      const result = await byPosition({}, inputs);
      expect(result.main).toEqual([
        { a: 1, b: 1 },
        { a: 2, b: 2 },
      ]);
    });

    it('outputs_the_unpaired_items_of_the_longer_input_unmerged_when_asked', async () => {
      const result = await byPosition({ includeUnpaired: fixed(true) }, inputs);
      expect(result.main).toEqual([{ a: 1, b: 1 }, { a: 2, b: 2 }, { a: 3 }]);
    });

    it('outputs_nothing_when_an_input_is_empty', async () => {
      const result = await byPosition({}, { input1: [], input2: [{ b: 1 }] });
      expect(result).toEqual({ main: [] });
    });

    it('outputs_the_other_side_of_an_empty_input_when_unpaired_items_are_included', async () => {
      const result = await byPosition(
        { includeUnpaired: fixed(true) },
        { input1: [], input2: [{ b: 1 }, { b: 2 }] },
      );
      expect(result.main).toEqual([{ b: 1 }, { b: 2 }]);
    });
  });

  describe('all combinations', () => {
    it('merges_every_input1_item_with_every_input2_item', async () => {
      const result = await merge(
        { mode: fixed('allCombinations') },
        { input1: [{ a: 1 }, { a: 2 }], input2: [{ b: 1 }, { b: 2 }] },
      );
      expect(result.main).toEqual([
        { a: 1, b: 1 },
        { a: 1, b: 2 },
        { a: 2, b: 1 },
        { a: 2, b: 2 },
      ]);
    });

    it('outputs_nothing_when_an_input_is_empty', async () => {
      const result = await merge(
        { mode: fixed('allCombinations') },
        { input1: [{ a: 1 }], input2: [] },
      );
      expect(result).toEqual({ main: [] });
    });
  });

  describe('choose input', () => {
    const inputs = { input1: [{ a: 1 }], input2: [{ b: 1 }, { b: 2 }] };

    it('outputs_the_items_of_input1_by_default', async () => {
      const result = await merge({ mode: fixed('chooseInput') }, inputs);
      expect(result).toEqual({ main: [{ a: 1 }] });
    });

    it('outputs_the_items_of_the_chosen_input', async () => {
      const result = await merge(
        { mode: fixed('chooseInput'), chosenInput: fixed('input2') },
        inputs,
      );
      expect(result).toEqual({ main: [{ b: 1 }, { b: 2 }] });
    });
  });

  it('declares_four_inputs_one_output_and_only_fixed_parameters', () => {
    const node = new MergeNode();
    expect(node.inputs).toEqual(['input1', 'input2', 'input3', 'input4']);
    expect(node.outputsFor()).toEqual(['main']);
    expect(node.fixedParameters).toEqual([
      'mode',
      'fields',
      'join',
      'clash',
      'includeUnpaired',
      'chosenInput',
    ]);
  });
});

describe('Merge within the step limits', () => {
  const limits = { items: 3, bytes: 1_000_000 };

  it('every_combination_beyond_the_item_limit_fails_before_it_is_built', async () => {
    await expect(
      runNode(new MergeNode(), {
        parameters: { mode: fixed('allCombinations') },
        inputs: { input1: [{ a: 1 }, { a: 2 }], input2: [{ b: 1 }, { b: 2 }] },
        limits,
      }),
    ).rejects.toBeInstanceOf(NodeLimitError);
  });

  it('matches_of_repeated_keys_beyond_the_item_limit_fail_before_they_are_built', async () => {
    await expect(
      runNode(new MergeNode(), {
        parameters: {
          mode: fixed('combineByFields'),
          fields: [{ field1: fixed('id'), field2: fixed('id') }],
        },
        inputs: {
          input1: [{ id: 1 }, { id: 1 }],
          input2: [{ id: 1 }, { id: 1 }],
        },
        limits,
      }),
    ).rejects.toBeInstanceOf(NodeLimitError);
  });
});
