import { WebhookEndpoint } from '../../../src/domain/webhook-endpoint.js';
import { WebhookSecret } from '../../../src/domain/webhook-secret.js';

const encrypted = (ciphertext: string) => ({ ciphertext, keyVersion: 'k-1' });

describe('WebhookEndpoint', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a_new_endpoint_gets_a_public_identifier_of_256_random_bits_for_its_node', () => {
    const endpoint = WebhookEndpoint.open('workflow-1', 'hook', encrypted('a'));
    const other = WebhookEndpoint.open('workflow-1', 'hook-2', encrypted('b'));
    expect(endpoint.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(endpoint.id).not.toBe(other.id);
    expect(endpoint.workflowId).toBe('workflow-1');
    expect(endpoint.nodeId).toBe('hook');
    expect(endpoint.secret).toEqual(encrypted('a'));
    expect(endpoint.rotatedAt).toBeNull();
  });

  it('rotating_replaces_the_secret_and_records_the_moment', () => {
    const endpoint = WebhookEndpoint.open('workflow-1', 'hook', encrypted('a'));
    vi.setSystemTime(new Date('2026-10-17T10:00:00.000Z'));
    endpoint.rotate(encrypted('b'));
    expect(endpoint.secret).toEqual(encrypted('b'));
    expect(endpoint.rotatedAt?.toISOString()).toBe('2026-10-17T10:00:00.000Z');
  });
});

describe('WebhookSecret', () => {
  it('a_generated_secret_carries_256_random_bits', () => {
    const secret = WebhookSecret.generate();
    expect(secret.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(WebhookSecret.generate().value).not.toBe(secret.value);
  });
});
