import { FilterNode } from '../../../src/interface-adapters/node-types/types/filter.node.js';
import { NodeUserError } from '../../../src/interface-adapters/node-types/node-user-error.js';
import { field, fixed, formula, runNode } from '../../support/node-runs.js';

const items = [
  { name: 'kibble', price: 10 },
  { name: 'litter', price: 25 },
  { name: 'toy', price: 3 },
];

const keep = (conditions: Record<string, unknown>) =>
  runNode(new FilterNode(), { items, parameters: { conditions } });

describe('Filter', () => {
  it('keeps_the_items_whose_conditions_hold_in_input_order', async () => {
    const result = await keep({
      rules: [
        {
          left: field('price'),
          operator: fixed('number:lt'),
          right: fixed(20),
        },
      ],
    });
    expect(result).toEqual({ main: [items[0], items[2]] });
  });

  it('evaluates_formulas_per_item_and_joins_rules_with_or', async () => {
    const result = await keep({
      combinator: fixed('or'),
      rules: [
        {
          left: formula('{{ $json.name.length }}'),
          operator: fixed('number:equals'),
          right: fixed(3),
        },
        {
          left: field('name'),
          operator: fixed('string:startsWith'),
          right: fixed('lit'),
        },
      ],
    });
    expect(result).toEqual({ main: [items[1], items[2]] });
  });

  it('outputs_no_items_when_no_item_matches', async () => {
    const result = await keep({
      rules: [
        {
          left: field('price'),
          operator: fixed('number:gt'),
          right: fixed(99),
        },
      ],
    });
    expect(result).toEqual({ main: [] });
  });

  it('a_filter_without_conditions_fails_the_node_with_the_parameter', async () => {
    const failure = keep({ rules: [] });
    await expect(failure).rejects.toBeInstanceOf(NodeUserError);
    await expect(failure).rejects.toMatchObject({
      parameter: 'conditions.rules',
    });
  });

  it('declares_one_main_output', () => {
    expect(new FilterNode().outputsFor()).toEqual(['main']);
  });
});
