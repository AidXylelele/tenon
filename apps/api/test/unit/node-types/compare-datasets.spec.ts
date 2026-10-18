import type { Item } from '../../../src/application/interfaces.js';
import { CompareDatasetsNode } from '../../../src/interface-adapters/node-types/types/compare-datasets.node.js';
import { NodeUserError } from '../../../src/interface-adapters/node-types/node-user-error.js';
import { fixed, runNode } from '../../support/node-runs.js';

const inputA = [
  { id: 1, name: 'Ann', address: { city: 'Kyiv', zip: '01001' } },
  { id: 2, name: 'Bob', city: 'Lviv' },
  { id: 3, name: 'Eve' },
];

const inputB = [
  { id: 2, name: 'Bob', city: 'Kharkiv', vip: true },
  { address: { zip: '01001', city: 'Kyiv' }, name: 'Ann', id: 1 },
  { id: 4, name: 'Max' },
];

const byId = [{ fieldA: fixed('id'), fieldB: fixed('id') }];

const compare = (
  inputs: Record<string, readonly Item[]>,
  fields: unknown = byId,
) => runNode(new CompareDatasetsNode(), { inputs, parameters: { fields } });

describe('Compare Datasets', () => {
  it('sends_a_matched_input_a_item_equal_to_its_partner_to_same_regardless_of_key_order', async () => {
    const result = await compare({ inputA, inputB });
    expect(result.same).toEqual([inputA[0]]);
  });

  it('describes_a_matched_pair_that_differs_by_its_keys_and_its_equal_and_different_fields', async () => {
    const result = await compare({ inputA, inputB });
    expect(result.different).toEqual([
      {
        keys: { id: 2 },
        same: { id: 2, name: 'Bob' },
        different: {
          city: { inputA: 'Lviv', inputB: 'Kharkiv' },
          vip: { inputB: true },
        },
      },
    ]);
  });

  it('sends_unmatched_items_of_input_a_to_in_a_and_of_input_b_to_in_b', async () => {
    const result = await compare({ inputA, inputB });
    expect(result.inA).toEqual([{ id: 3, name: 'Eve' }]);
    expect(result.inB).toEqual([{ id: 4, name: 'Max' }]);
  });

  it('outputs_all_four_outputs_even_when_they_are_empty', async () => {
    const result = await compare({ inputA: [], inputB: [] });
    expect(result).toEqual({ inA: [], same: [], different: [], inB: [] });
  });

  it('matches_by_every_pair_of_fields_read_by_dot_path_and_keys_the_difference_by_input_a_fields', async () => {
    const result = await compare(
      {
        inputA: [
          { id: 1, meta: { region: 'north' }, stock: 3 },
          { id: 1, meta: { region: 'south' }, stock: 5 },
        ],
        inputB: [{ customerId: 1, region: 'south', stock: 4 }],
      },
      [
        { fieldA: fixed('id'), fieldB: fixed('customerId') },
        { fieldA: fixed('meta.region'), fieldB: fixed('region') },
      ],
    );
    expect(result).toEqual({
      inA: [{ id: 1, meta: { region: 'north' }, stock: 3 }],
      same: [],
      different: [
        {
          keys: { id: 1, 'meta.region': 'south' },
          same: {},
          different: {
            id: { inputA: 1 },
            meta: { inputA: { region: 'south' } },
            stock: { inputA: 5, inputB: 4 },
            customerId: { inputB: 1 },
            region: { inputB: 'south' },
          },
        },
      ],
      inB: [],
    });
  });

  it('matches_each_item_at_most_once_taking_the_first_match', async () => {
    const result = await compare({
      inputA: [
        { id: 1, v: 1 },
        { id: 1, v: 1 },
      ],
      inputB: [
        { id: 1, v: 1 },
        { id: 1, v: 2 },
        { id: 1, v: 3 },
      ],
    });
    expect(result).toEqual({
      inA: [],
      same: [{ id: 1, v: 1 }],
      different: [
        {
          keys: { id: 1 },
          same: { id: 1 },
          different: { v: { inputA: 1, inputB: 2 } },
        },
      ],
      inB: [{ id: 1, v: 3 }],
    });
  });

  it('never_matches_items_that_both_miss_a_key_field', async () => {
    const result = await compare({
      inputA: [{ name: 'Ann' }],
      inputB: [{ name: 'Ann' }],
    });
    expect(result.inA).toEqual([{ name: 'Ann' }]);
    expect(result.inB).toEqual([{ name: 'Ann' }]);
  });

  it('without_key_fields_fails_the_node_with_the_parameter', async () => {
    const failure = compare({ inputA, inputB }, []);
    await expect(failure).rejects.toBeInstanceOf(NodeUserError);
    await expect(failure).rejects.toMatchObject({ parameter: 'fields' });
  });

  it('declares_two_inputs_and_four_outputs', () => {
    const node = new CompareDatasetsNode();
    expect(node.inputs).toEqual(['inputA', 'inputB']);
    expect(node.outputsFor()).toEqual(['inA', 'same', 'different', 'inB']);
  });
});
