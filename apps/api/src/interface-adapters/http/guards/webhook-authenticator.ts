import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookSettings } from '../../../application/interfaces.js';

export interface WebhookCall {
  readonly settings: WebhookSettings;
  readonly secret: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly rawBody: Buffer;
  readonly now: number;
}

export class WebhookAuthenticator {
  static readonly SKEW_MS = 5 * 60_000;
  static readonly TOKEN_HEADER = 'x-webhook-token';
  static readonly SIGNATURE_HEADER = 'x-webhook-signature';
  static readonly TIMESTAMP_HEADER = 'x-webhook-timestamp';

  verify(call: WebhookCall): boolean {
    const method = call.method.toUpperCase();
    const permitted = call.settings.methods.some(
      (allowed) => allowed === method,
    );

    if (!permitted) return false;

    if (call.settings.authentication === 'token') {
      const token = WebhookAuthenticator.header(
        call,
        WebhookAuthenticator.TOKEN_HEADER,
      );
      return WebhookAuthenticator.same(token, call.secret);
    }

    return WebhookAuthenticator.signed(call);
  }

  private static signed(call: WebhookCall): boolean {
    const timestamp = WebhookAuthenticator.header(
      call,
      WebhookAuthenticator.TIMESTAMP_HEADER,
    );
    const signature = WebhookAuthenticator.header(
      call,
      WebhookAuthenticator.SIGNATURE_HEADER,
    );

    if (!timestamp) return false;

    const wellFormed = /^\d{1,12}$/.test(timestamp);

    if (!wellFormed) return false;

    const sentAt = Number(timestamp) * 1000;
    const drift = call.now - sentAt;
    const skew = Math.abs(drift);

    if (skew > WebhookAuthenticator.SKEW_MS) return false;

    const expected = createHmac('sha256', call.secret)
      .update(`${timestamp}.`)
      .update(call.rawBody)
      .digest('hex');
    return WebhookAuthenticator.same(signature, `sha256=${expected}`);
  }

  private static header(call: WebhookCall, name: string): string | undefined {
    const value = call.headers[name];
    const repeated = Array.isArray(value);

    return repeated ? value[0] : value;
  }

  private static same(given: string | undefined, expected: string): boolean {
    if (given === undefined) return false;

    const left = Buffer.from(given);
    const right = Buffer.from(expected);

    if (left.length !== right.length) return false;

    return timingSafeEqual(left, right);
  }
}
