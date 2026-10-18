import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ResolvedWebhook } from '../../../application/interfaces.js';
import { ResolveWebhook } from '../../../application/use-cases/resolve-webhook.js';
import { WebhookEndpointNotFoundError } from '../../../domain/errors.js';
import { JsonLimits } from '../validators/json-limits.js';
import { WebhookAuthenticator } from './webhook-authenticator.js';

export interface WebhookIngressRequest extends RawBodyRequest<Request> {
  webhook?: ResolvedWebhook;
}

@Injectable()
export class WebhookIngressGuard implements CanActivate {
  static readonly ENDPOINT_ID = /^[\w-]{43}$/;
  static readonly MAX_BODY_BYTES = 1024 * 1024;

  readonly #authenticator = new WebhookAuthenticator();

  constructor(private readonly resolveWebhook: ResolveWebhook) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WebhookIngressRequest>();
    const endpointId = WebhookIngressGuard.endpointIdOf(request);
    const wellFormed = WebhookIngressGuard.ENDPOINT_ID.test(endpointId);

    if (!wellFormed) throw new NotFoundException();

    const webhook = await this.resolved(endpointId);
    const rawBody = request.rawBody ?? Buffer.alloc(0);
    const now = Date.now();
    const accepted =
      webhook !== null &&
      this.#authenticator.verify({
        settings: webhook.settings,
        secret: webhook.secret,
        method: request.method,
        headers: request.headers,
        rawBody,
        now,
      });

    if (!webhook || !accepted) throw new NotFoundException();

    if (rawBody.length > WebhookIngressGuard.MAX_BODY_BYTES) {
      throw new PayloadTooLargeException();
    }

    const depth = JsonLimits.depthOf(request.body);

    if (depth > JsonLimits.DEPTH) {
      throw new BadRequestException(
        `The body must nest at most ${JsonLimits.DEPTH} levels`,
      );
    }

    request.webhook = webhook;
    return true;
  }

  static endpointIdOf(request: WebhookIngressRequest): string {
    const endpointId = request.params['endpointId'];
    return typeof endpointId === 'string' ? endpointId : '';
  }

  private async resolved(endpointId: string): Promise<ResolvedWebhook | null> {
    try {
      return await this.resolveWebhook.execute(endpointId);
    } catch (error) {
      if (error instanceof WebhookEndpointNotFoundError) return null;

      throw error;
    }
  }
}
