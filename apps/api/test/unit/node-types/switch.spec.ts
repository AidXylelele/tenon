import { SwitchNode } from '../../../src/interface-adapters/node-types/types/switch.node.js';
import { NodeUserError } from '../../../src/interface-adapters/node-types/node-user-error.js';
import { field, fixed, formula, runNode } from '../../support/node-runs.js';

const items = [
  { name: 'kibble', price: 10 },
  { name: 'litter', price: 25 },
  { name: 'toy', price: 3 },
];

const price = (operator: string, right: number) => ({
  rules: [
    { left: field('price'), operator: fixed(operator), right: fixed(right) },
  ],
});

const route = (parameters: Record<string, unknown>) =>
  runNode(new SwitchNode(), { items, parameters });

describe('Switch', () => {
  it('routes_each_item_to_the_output_of_the_first_rule_it_matches', async () => {
    const result = await route({
      rules: [
        { conditions: price('number:gte', 20), output: fixed('expensive') },
        { conditions: price('number:gte', 0), output: fixed('regular') },
      ],
    });
    expect(result).toEqual({
      expensive: [items[1]],
      regular: [items[0], items[2]],
    });
  });

  it('names_an_output_by_the_rule_index_when_the_rule_has_no_output_name', async () => {
    const result = await route({
      rules: [
        { conditions: price('number:gte', 20) },
        { conditions: price('number:lt', 20) },
      ],
    });
    expect(result).toEqual({ '0': [items[1]], '1': [items[0], items[2]] });
  });

  it('evaluates_the_rules_for_each_item_with_formulas', async () => {
    const result = await route({
      rules: [
        {
          conditions: {
            rules: [
              {
                left: formula('{{ $json.price * 2 }}'),
                operator: fixed('number:gt'),
                right: fixed(15),
              },
            ],
          },
          output: fixed('doubled'),
        },
      ],
    });
    expect(result).toEqual({ doubled: [items[0], items[1]] });
  });

  it('sends_an_item_to_every_matching_output_when_all_matching_is_on', async () => {
    const result = await route({
      rules: [
        { conditions: price('number:gte', 10), output: fixed('ten') },
        { conditions: price('number:gte', 20), output: fixed('twenty') },
      ],
      allMatching: fixed(true),
    });
    expect(result).toEqual({ ten: [items[0], items[1]], twenty: [items[1]] });
  });

  it('sends_an_item_once_to_an_output_that_two_matching_rules_share', async () => {
    const result = await route({
      rules: [
        { conditions: price('number:gte', 10), output: fixed('stock') },
        { conditions: price('number:gte', 20), output: fixed('stock') },
      ],
      allMatching: fixed(true),
    });
    expect(result).toEqual({ stock: [items[0], items[1]] });
  });

  it('drops_items_that_match_no_rule_when_there_is_no_fallback', async () => {
    const result = await route({
      rules: [
        { conditions: price('number:gte', 20), output: fixed('expensive') },
      ],
    });
    expect(result).toEqual({ expensive: [items[1]] });
  });

  it('sends_items_that_match_no_rule_to_the_fallback_output_when_it_is_extra', async () => {
    const result = await route({
      rules: [
        { conditions: price('number:gte', 20), output: fixed('expensive') },
      ],
      fallback: fixed('extra'),
    });
    expect(result).toEqual({
      expensive: [items[1]],
      fallback: [items[0], items[2]],
    });
  });

  it('keeps_an_empty_output_for_a_rule_or_fallback_no_item_reaches', async () => {
    const result = await route({
      rules: [
        { conditions: price('number:gte', 100), output: fixed('luxury') },
        { conditions: price('number:gte', 0), output: fixed('all') },
      ],
      fallback: fixed('extra'),
    });
    expect(result).toEqual({ luxury: [], all: items, fallback: [] });
  });

  it('a_switch_without_rules_fails_the_node_with_the_parameter', async () => {
    const failure = route({ rules: [] });
    await expect(failure).rejects.toBeInstanceOf(NodeUserError);
    await expect(failure).rejects.toMatchObject({ parameter: 'rules' });
  });

  it('declares_one_output_per_rule_by_name_or_index_then_the_fallback', () => {
    const outputs = new SwitchNode().outputsFor({
      rules: [{ output: 'high' }, {}, { output: '' }],
      fallback: 'extra',
    });
    expect(outputs).toEqual(['high', '1', '2', 'fallback']);
  });

  it('declares_no_outputs_when_the_rules_are_missing', () => {
    expect(new SwitchNode().outputsFor({})).toEqual([]);
  });

  it('takes_its_outputs_from_the_rules_parameter', () => {
    expect(new SwitchNode().outputsParameter).toBe('rules');
  });
});
