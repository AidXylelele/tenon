import { LimitNode } from '../../../src/interface-adapters/node-types/types/limit.node.js';
import { fixed, runNode } from '../../support/node-runs.js';

const items = [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }, { n: 5 }];

const limit = (parameters: Record<string, unknown>) =>
  runNode(new LimitNode(), { items, parameters });

describe('Limit', () => {
  it('keeps_only_the_first_item_by_default', async () => {
    expect((await limit({})).main).toEqual([{ n: 1 }]);
  });

  it('keeps_the_first_items_up_to_the_maximum', async () => {
    const result = await limit({ maxItems: fixed(3) });
    expect(result.main).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });

  it('keeps_the_last_items_up_to_the_maximum', async () => {
    const result = await limit({ maxItems: fixed(2), keep: fixed('last') });
    expect(result.main).toEqual([{ n: 4 }, { n: 5 }]);
  });

  it('keeps_every_item_when_there_are_fewer_than_the_maximum', async () => {
    const result = await limit({ maxItems: fixed(10), keep: fixed('last') });
    expect(result.main).toEqual(items);
  });

  it('a_maximum_that_is_not_a_whole_number_of_at_least_one_fails_the_node', async () => {
    await expect(limit({ maxItems: fixed(0) })).rejects.toMatchObject({
      parameter: 'maxItems',
    });
    await expect(limit({ maxItems: fixed(1.5) })).rejects.toMatchObject({
      parameter: 'maxItems',
    });
  });
});
