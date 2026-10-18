import { createHmac } from 'node:crypto';
import { WebhookAuthenticator } from '../../../src/interface-adapters/http/guards/webhook-authenticator.js';

const SECRET = 'a'.repeat(43);
const NOW = Date.parse('2026-10-16T10:00:00.000Z');
const body = Buffer.from('{"order":7}');

const signed = (timestamp: number, secret = SECRET, raw = body) =>
  `sha256=${createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest('hex')}`;

const authenticator = new WebhookAuthenticator();

describe('WebhookAuthenticator', () => {
  it('a_token_call_passes_with_the_exact_secret_only', () => {
    const check = (token: string | undefined) =>
      authenticator.verify({
        settings: { methods: ['POST'], authentication: 'token' },
        secret: SECRET,
        method: 'POST',
        headers: { 'x-webhook-token': token },
        rawBody: body,
        now: NOW,
      });
    expect(check(SECRET)).toBe(true);
    expect(check(`${SECRET}x`)).toBe(false);
    expect(check(undefined)).toBe(false);
  });

  it('a_signed_call_passes_within_five_minutes_of_its_timestamp', () => {
    const seconds = NOW / 1000;
    const check = (timestamp: number, signature: string, raw = body) =>
      authenticator.verify({
        settings: { methods: ['POST'], authentication: 'signature' },
        secret: SECRET,
        method: 'POST',
        headers: {
          'x-webhook-timestamp': String(timestamp),
          'x-webhook-signature': signature,
        },
        rawBody: raw,
        now: NOW,
      });
    expect(check(seconds, signed(seconds))).toBe(true);
    expect(check(seconds - 299, signed(seconds - 299))).toBe(true);
    expect(check(seconds - 301, signed(seconds - 301))).toBe(false);
    expect(check(seconds, signed(seconds, 'other'))).toBe(false);
    expect(check(seconds, signed(seconds), Buffer.from('{"order":8}'))).toBe(
      false,
    );
    expect(check(seconds, 'sha256=zz')).toBe(false);
  });

  it('a_method_the_node_does_not_accept_is_refused', () => {
    expect(
      authenticator.verify({
        settings: { methods: ['POST'], authentication: 'token' },
        secret: SECRET,
        method: 'GET',
        headers: { 'x-webhook-token': SECRET },
        rawBody: body,
        now: NOW,
      }),
    ).toBe(false);
  });
});
