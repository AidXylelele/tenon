import { Injectable } from '@nestjs/common';
import { type ResiliencePolicy, ResilienceService } from '@nestjs/resilience';
import { request as send } from 'undici';
import type { JsonObject } from '../../domain/automation/json.js';
import { DeliveryScheme } from '../../domain/automation/subscriptions/enums.js';
import type { DeliveryClient } from '../../interface-adapters/messaging/interfaces.js';
import { EndpointDispatcher } from './endpoint-dispatcher.js';

// A delivery in CloudEvents' HTTP structured mode, through the dispatcher whose address
// policy refuses private destinations; the `service-calls` preset bounds it. A secret's value
// becomes the header, and is masked in any error.
@Injectable()
export class UndiciDeliveryClient implements DeliveryClient {
  private static readonly PRESET = 'service-calls';
  private static readonly STRUCTURED = 'application/cloudevents+json';
  private static readonly MASK = '***';

  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly dispatcher: EndpointDispatcher,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset(UndiciDeliveryClient.PRESET);
  }

  async post(
    uri: string,
    scheme: DeliveryScheme | null,
    credential: string | null,
    event: JsonObject,
  ): Promise<string | null> {
    const headers: Record<string, string> = {
      'content-type': UndiciDeliveryClient.STRUCTURED,
    };
    const authorization = UndiciDeliveryClient.authorizationOf(
      scheme,
      credential,
    );

    if (authorization !== null) headers.authorization = authorization;

    const body = JSON.stringify(event);
    const error = await this.#sent(uri, headers, body);

    if (error === null || credential === null) return error;

    return error.replaceAll(credential, UndiciDeliveryClient.MASK);
  }

  async #sent(
    uri: string,
    headers: Record<string, string>,
    body: string,
  ): Promise<string | null> {
    try {
      const status = await this.policy.execute(async ({ signal }) => {
        const response = await send(uri, {
          dispatcher: this.dispatcher,
          method: 'POST',
          headers,
          body,
          signal,
        });
        await response.body.dump();
        return response.statusCode;
      });
      const accepted = status >= 200 && status < 300;
      return accepted ? null : `The destination answered ${String(status)}`;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      return `The destination could not be reached: ${reason}`;
    }
  }

  private static authorizationOf(
    scheme: DeliveryScheme | null,
    credential: string | null,
  ): string | null {
    if (scheme === null || credential === null) return null;

    const parsed = UndiciDeliveryClient.parsed(credential);

    if (scheme === DeliveryScheme.Basic) {
      const username = UndiciDeliveryClient.textOf(parsed.username);
      const password = UndiciDeliveryClient.textOf(parsed.password);
      const pair = Buffer.from(`${username}:${password}`, 'utf8');
      return `Basic ${pair.toString('base64')}`;
    }

    const token = typeof parsed.token === 'string' ? parsed.token : credential;
    return `Bearer ${token}`;
  }

  private static textOf(value: JsonObject[string] | undefined): string {
    return typeof value === 'string' ? value : '';
  }

  private static parsed(credential: string): JsonObject {
    try {
      const value = JSON.parse(credential) as unknown;
      const object =
        value !== null && typeof value === 'object' && !Array.isArray(value);
      return object ? (value as JsonObject) : {};
    } catch {
      return {};
    }
  }
}
