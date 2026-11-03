import { Injectable } from '@nestjs/common';
import type { AcceptedEvent } from '../../application/automation/events/ports.js';
import type { EventSender } from '../../application/automation/subscriptions/ports.js';
import type { JsonObject } from '../../domain/automation/json.js';
import { DeliveryScheme } from '../../domain/automation/subscriptions/enums.js';
import type { DeliveryEndpoint } from '../../domain/automation/subscriptions/interfaces.js';
import { DeliveryClient, type DeliveryAuthorization } from './interfaces.js';

// A delivery's credential as its header: a basic secret holds a username and a password, a
// bearer one the token (or `token`); the error never repeats the credential.
@Injectable()
export class EventSenderGateway implements EventSender {
  private static readonly MASK = '***';

  constructor(private readonly client: DeliveryClient) {}

  async send(
    endpoint: DeliveryEndpoint,
    credential: string | null,
    event: AcceptedEvent,
  ): Promise<string | null> {
    const authorization = EventSenderGateway.authorizationOf(
      endpoint,
      credential,
    );
    const error = await this.client.post(
      endpoint.uri,
      authorization,
      event.cloudEvent,
    );

    if (error === null || credential === null) return error;

    return error.replaceAll(credential, EventSenderGateway.MASK);
  }

  private static authorizationOf(
    endpoint: DeliveryEndpoint,
    credential: string | null,
  ): DeliveryAuthorization | null {
    if (credential === null) return null;

    const parsed = EventSenderGateway.parsed(credential);

    if (endpoint.scheme === DeliveryScheme.Basic) {
      const username = EventSenderGateway.textOf(parsed.username);
      const password = EventSenderGateway.textOf(parsed.password);
      const pair = `${username}:${password}`;
      const parameter = Buffer.from(pair, 'utf8').toString('base64');
      return { scheme: 'Basic', parameter };
    }

    const token = typeof parsed.token === 'string' ? parsed.token : credential;
    return { scheme: 'Bearer', parameter: token };
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
