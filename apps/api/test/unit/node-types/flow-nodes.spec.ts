import { IfNode } from '../../../src/interface-adapters/node-types/types/if.node.js';
import { ManualTriggerNode } from '../../../src/interface-adapters/node-types/types/manual-trigger.node.js';
import { NoOpNode } from '../../../src/interface-adapters/node-types/types/no-op.node.js';
import { NodeUserError } from '../../../src/interface-adapters/node-types/node-user-error.js';
import { StopAndErrorNode } from '../../../src/interface-adapters/node-types/types/stop-and-error.node.js';
import { field, fixed, formula, runNode } from '../../support/node-runs.js';

const items = [
  { name: 'kibble', price: 10 },
  { name: 'litter', price: 25 },
  { name: 'toy', price: 3 },
];

describe('If', () => {
  it('routes_matching_items_to_true_and_the_rest_to_false_in_input_order', async () => {
    const result = await runNode(new IfNode(), {
      items,
      parameters: {
        conditions: {
          rules: [
            {
              left: field('price'),
              operator: fixed('number:gte'),
              right: fixed(10),
            },
          ],
        },
      },
    });
    expect(result).toEqual({
      true: [items[0], items[1]],
      false: [items[2]],
    });
  });

  it('evaluates_formulas_per_item_and_joins_rules_with_or', async () => {
    const result = await runNode(new IfNode(), {
      items,
      parameters: {
        conditions: {
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
        },
      },
    });
    expect(result.true).toEqual([items[1], items[2]]);
  });

  it('declares_its_two_outputs', () => {
    expect(new IfNode().outputsFor()).toEqual(['true', 'false']);
  });
});

describe('No Operation', () => {
  it('passes_items_through_unchanged', async () => {
    expect(await runNode(new NoOpNode(), { items })).toEqual({ main: items });
  });
});

describe('Stop and Error', () => {
  it('fails_the_node_with_the_configured_message', async () => {
    await expect(
      runNode(new StopAndErrorNode(), {
        items,
        parameters: { message: formula('Order {{ $json.name }} is invalid') },
      }),
    ).rejects.toEqual(new NodeUserError('Order kibble is invalid'));
  });
});

describe('Manual Trigger', () => {
  it('is_a_manual_trigger_without_inputs_that_hands_its_items_on', async () => {
    const trigger = new ManualTriggerNode();
    expect(trigger.trigger).toBe('manual');
    expect(trigger.inputs).toEqual([]);
    expect(await runNode(trigger, { items })).toEqual({ main: items });
  });
});
