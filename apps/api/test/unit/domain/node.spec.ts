import { ErrorKind, TriggerType } from '../../../src/domain/enums.js';
import type { NodeFailure } from '../../../src/domain/interfaces.js';
import { Node } from '../../../src/domain/node.js';
import { aNode, defaultSettings } from '../../support/automation-builders.js';

const failure = (
  kind: ErrorKind,
  overrides: Partial<NodeFailure> = {},
): NodeFailure => ({
  kind,
  message: 'it broke',
  parameter: null,
  item: null,
  typeUnavailable: false,
  ...overrides,
});

const withRetries = (attempts: number, waitMs: number) =>
  new Node(
    aNode('a', { settings: defaultSettings({ retry: { attempts, waitMs } }) }),
  );

describe('Node', () => {
  it('a_node_with_a_trigger_kind_is_a_trigger', () => {
    expect(
      new Node(aNode('a', { trigger: TriggerType.Manual })).isTrigger,
    ).toBe(true);
    expect(new Node(aNode('a')).isTrigger).toBe(false);
  });

  it('a_user_error_is_retried_after_the_configured_wait_until_the_attempts_run_out', () => {
    const node = withRetries(3, 2_000);
    expect(node.retryDelay(failure(ErrorKind.User), 1)).toBe(2_000);
    expect(node.retryDelay(failure(ErrorKind.User), 2)).toBe(2_000);
    expect(node.retryDelay(failure(ErrorKind.User), 3)).toBeNull();
  });

  it('a_user_error_is_not_retried_by_default', () => {
    expect(
      new Node(aNode('a')).retryDelay(failure(ErrorKind.User), 1),
    ).toBeNull();
  });

  it('limit_and_isolation_breaches_are_never_retried_whatever_the_setting', () => {
    const node = withRetries(5, 0);
    expect(node.retryDelay(failure(ErrorKind.Limit), 1)).toBeNull();
    expect(node.retryDelay(failure(ErrorKind.Isolation), 1)).toBeNull();
  });

  it('a_platform_error_is_retried_three_times_with_a_doubling_back_off', () => {
    const node = new Node(aNode('a'));
    expect(node.retryDelay(failure(ErrorKind.Platform), 1)).toBe(1_000);
    expect(node.retryDelay(failure(ErrorKind.Platform), 2)).toBe(2_000);
    expect(node.retryDelay(failure(ErrorKind.Platform), 3)).toBeNull();
  });

  it('an_unknown_node_type_version_is_retried_for_up_to_fifteen_minutes', () => {
    const node = new Node(aNode('a'));
    const unavailable = failure(ErrorKind.Platform, { typeUnavailable: true });
    const delays: number[] = [];
    let attempt = 1;
    let delay = node.retryDelay(unavailable, attempt);

    while (delay !== null) {
      delays.push(delay);
      attempt += 1;
      delay = node.retryDelay(unavailable, attempt);
    }

    expect(delays.slice(0, 5)).toEqual([5_000, 10_000, 20_000, 40_000, 60_000]);
    const total = delays.reduce((sum, wait) => sum + wait, 0);
    expect(total).toBeGreaterThanOrEqual(15 * 60_000);
    expect(total).toBeLessThan(16 * 60_000);
  });
});
