import { Public } from '@nestjs/authentication';
import {
  All,
  Controller,
  Headers,
  HttpCode,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Idempotent } from '@nestjs/idempotency';
import {
  ApiAcceptedResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Transactional } from '@nestjs-cls/transactional';
import type { IncomingHttpHeaders } from 'node:http';
import { StartWebhookRun } from '../../../application/use-cases/start-webhook-run.js';
import { RunLauncher } from '../../workflows/run-launcher.js';
import { QueuedRunResponse } from '../dto/automation-responses.dto.js';
import { WebhookErrorFilter } from '../filters/webhook-error.filter.js';
import {
  WebhookIngressGuard,
  type WebhookIngressRequest,
} from '../guards/webhook-ingress.guard.js';
import { RunPresenter } from '../presenters/run.presenter.js';

const HIDDEN_HEADERS = [
  'x-webhook-token',
  'x-webhook-signature',
  'cookie',
  'authorization',
  'proxy-authorization',
];

@ApiTags('ingress')
@Controller('webhooks')
@Public()
@UseGuards(WebhookIngressGuard)
@UseFilters(WebhookErrorFilter)
export class WebhooksController {
  constructor(
    private readonly startWebhookRun: StartWebhookRun,
    private readonly launcher: RunLauncher,
  ) {}

  @All(':endpointId')
  @HttpCode(202)
  @Idempotent({
    keyFrom: { header: 'x-delivery-id' },
    scope: {
      http: (request: WebhookIngressRequest) =>
        WebhookIngressGuard.endpointIdOf(request),
    },
    ttl: '7d',
  })
  @Transactional()
  @ApiAcceptedResponse({ type: QueuedRunResponse })
  @ApiNotFoundResponse({
    description: 'No run started; the same answer for every refusal',
  })
  async receive(
    @Req() request: WebhookIngressRequest,
    @Headers('x-delivery-id') deliveryHeader: string | undefined,
  ): Promise<QueuedRunResponse> {
    const webhook = request.webhook!;
    const deliveryId = deliveryHeader ?? null;
    const headers = WebhooksController.visibleHeaders(request.headers);
    const run = await this.startWebhookRun.execute({
      endpointId: webhook.endpointId,
      workflowId: webhook.workflowId,
      releaseNumber: webhook.releaseNumber,
      nodeId: webhook.nodeId,
      deliveryId,
      request: {
        method: request.method,
        headers,
        query: request.query,
        body: request.body,
      },
    });
    await this.launcher.launch(run);
    return RunPresenter.queued(run);
  }

  private static visibleHeaders(
    headers: IncomingHttpHeaders,
  ): Record<string, string | string[]> {
    const visible: Record<string, string | string[]> = {};

    for (const [name, value] of Object.entries(headers)) {
      const hidden = HIDDEN_HEADERS.includes(name);

      if (value === undefined || hidden) continue;

      visible[name] = value;
    }

    return visible;
  }
}
