import { Webhook } from '../../../../src/domain/automation/webhooks/webhook.js';
import { WebhookToken } from '../../../../src/domain/automation/webhooks/webhook-token.js';

const now = new Date('2026-11-03T10:00:00.000Z');

function aWebhook(token: WebhookToken = WebhookToken.generate()): Webhook {
  return Webhook.create({
    name: 'forms',
    eventType: 'com.example.form.submitted',
    token,
    now,
  });
}

describe('Webhook', () => {
  it('keeps_only_the_fingerprint_of_its_token', () => {
    const token = new WebhookToken('secret-token');

    const webhook = aWebhook(token);

    expect(webhook.tokenFingerprint).toBe(token.fingerprint);
    expect(webhook.tokenFingerprint).not.toContain('secret-token');
    expect(webhook.tokenFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a_generated_token_is_unguessable_and_new_each_time', () => {
    const first = WebhookToken.generate();
    const second = WebhookToken.generate();

    expect(first.value).not.toBe(second.value);
    expect(first.value.length).toBeGreaterThanOrEqual(43);
  });

  it('a_call_becomes_an_event_of_its_type_with_body_query_and_headers', () => {
    const webhook = aWebhook();

    const event = webhook.receive(
      {
        body: { order: 7 },
        query: { source: 'shop' },
        headers: { 'content-type': 'application/json' },
        key: null,
      },
      now,
    );

    expect(event).toMatchObject({
      source: `/webhooks/${webhook.id}`,
      type: 'com.example.form.submitted',
      at: now,
      data: {
        body: { order: 7 },
        query: { source: 'shop' },
        headers: { 'content-type': 'application/json' },
      },
    });
  });

  it('the_callers_key_identifies_the_event_so_a_repeat_is_the_same', () => {
    const webhook = aWebhook();
    const call = { body: null, query: {}, headers: {}, key: 'delivery-1' };

    const first = webhook.receive(call, now);
    const second = webhook.receive(call, now);

    expect(first.id).toBe('delivery-1');
    expect(second.id).toBe(first.id);
  });

  it('calls_without_a_key_are_distinct_events', () => {
    const webhook = aWebhook();
    const call = { body: null, query: {}, headers: {}, key: null };

    const first = webhook.receive(call, now);
    const second = webhook.receive(call, now);

    expect(first.id).not.toBe(second.id);
  });
});
