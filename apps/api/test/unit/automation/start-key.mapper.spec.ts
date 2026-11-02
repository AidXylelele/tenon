import { WorkflowName } from '../../../src/domain/automation/language/workflow-name.js';
import { WorkflowTarget } from '../../../src/domain/automation/language/workflow-target.js';
import { StartKeyMapper } from '../../../src/interface-adapters/api/mappers/start-key.mapper.js';

const orders = new WorkflowName('default', 'orders');
const latest = WorkflowTarget.of(orders, null);

describe('StartKeyMapper', () => {
  it('a_start_without_an_idempotency_key_has_no_start_key', () => {
    const key = StartKeyMapper.toKey(undefined, latest, { a: 1 });

    expect(key).toBeNull();
  });

  it('the_same_request_gives_the_same_key_whatever_the_order_of_its_members', () => {
    const first = StartKeyMapper.toKey('k', latest, {
      a: 1,
      b: { c: 2, d: 3 },
    });
    const second = StartKeyMapper.toKey('k', latest, {
      b: { d: 3, c: 2 },
      a: 1,
    });

    expect(first).toBe(second);
  });

  it('no_version_is_latest_and_no_input_is_an_empty_object', () => {
    const named = new WorkflowTarget(orders, 'latest');

    const implicit = StartKeyMapper.toKey('k', latest, undefined);
    const explicit = StartKeyMapper.toKey('k', named, {});

    expect(implicit).toBe(explicit);
  });

  it('another_version_or_input_gives_another_key', () => {
    const pinned = new WorkflowTarget(orders, '1.0.0');

    const base = StartKeyMapper.toKey('k', latest, { a: 1 });
    const version = StartKeyMapper.toKey('k', pinned, { a: 1 });
    const input = StartKeyMapper.toKey('k', latest, { a: 2 });

    expect(version).not.toBe(base);
    expect(input).not.toBe(base);
  });
});
