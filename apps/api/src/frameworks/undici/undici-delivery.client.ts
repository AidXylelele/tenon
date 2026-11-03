import { Injectable } from '@nestjs/common';
import { type ResiliencePolicy, ResilienceService } from '@nestjs/resilience';
import { request as send } from 'undici';
import type { JsonObject } from '../../domain/automation/json.js';
import type {
  DeliveryAuthorization,
  DeliveryClient,
} from '../../interface-adapters/messaging/interfaces.js';
import { EndpointDispatcher } from './endpoint-dispatcher.js';

// A delivery in CloudEvents' HTTP structured mode, through the dispatcher whose address
// policy refuses private destinations; the `service-calls` preset bounds it.
@Injectable()
export class UndiciDeliveryClient implements DeliveryClient {
  private static readonly PRESET = 'service-calls';
  private static readonly STRUCTURED = 'application/cloudevents+json';

  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly dispatcher: EndpointDispatcher,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset(UndiciDeliveryClient.PRESET);
  }

  async post(
    uri: string,
    authorization: DeliveryAuthorization | null,
    event: JsonObject,
  ): Promise<string | null> {
    const headers: Record<string, string> = {
      'content-type': UndiciDeliveryClient.STRUCTURED,
    };

    if (authorization !== null)
      headers.authorization = `${authorization.scheme} ${authorization.parameter}`;

    const body = JSON.stringify(event);

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
}
