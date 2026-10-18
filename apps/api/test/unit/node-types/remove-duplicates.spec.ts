import { NodeUserError } from '../../../src/interface-adapters/node-types/node-user-error.js';
import { RemoveDuplicatesNode } from '../../../src/interface-adapters/node-types/types/remove-duplicates.node.js';
import { fixed, runNode } from '../../support/node-runs.js';

const contacts = [
  { email: 'ada@shop.test', name: 'Ada', meta: { source: 'web', seen: 1 } },
  { name: 'Ada', email: 'ada@shop.test', meta: { seen: 1, source: 'web' } },
  { email: 'ada@shop.test', name: 'Ada L.', meta: { source: 'web', seen: 2 } },
  { email: 'bob@shop.test', name: 'Bob', meta: { source: 'shop', seen: 3 } },
];

const [first, reordered, renamed, bob] = contacts;

const deduplicate = (parameters: Record<string, unknown>) =>
  runNode(new RemoveDuplicatesNode(), { items: contacts, parameters });

describe('Remove Duplicates', () => {
  it('keeps_the_first_of_items_equal_in_all_fields_whatever_their_key_order', async () => {
    const result = await deduplicate({});
    expect(result.main).toEqual([first, renamed, bob]);
  });

  it('compares_only_the_selected_fields', async () => {
    const result = await deduplicate({
      compare: fixed('selectedFields'),
      fields: [fixed('email'), fixed('meta.source')],
    });
    expect(result.main).toEqual([first, bob]);
  });

  it('compares_all_fields_except_the_listed_ones', async () => {
    const result = await deduplicate({
      compare: fixed('allFieldsExcept'),
      fields: [fixed('name'), fixed('meta.seen')],
    });
    expect(result.main).toEqual([first, bob]);
  });

  it('compares_selected_nested_fields_by_path', async () => {
    const result = await deduplicate({
      compare: fixed('selectedFields'),
      fields: [fixed('meta.seen')],
    });
    expect(result.main).toEqual([first, renamed, bob]);
  });

  it('the_selected_fields_mode_without_fields_fails_the_node_on_the_fields_parameter', async () => {
    const result = deduplicate({ compare: fixed('selectedFields') });
    await expect(result).rejects.toBeInstanceOf(NodeUserError);
    await expect(result).rejects.toMatchObject({ parameter: 'fields' });
  });

  it('does_not_change_the_input_items', async () => {
    await deduplicate({
      compare: fixed('allFieldsExcept'),
      fields: [fixed('meta')],
    });
    expect(reordered).toEqual({
      name: 'Ada',
      email: 'ada@shop.test',
      meta: { seen: 1, source: 'web' },
    });
  });
});
