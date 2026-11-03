import { Can } from '@nestjs/authorization';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseFilters,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CreateWebhook } from '../../../application/automation/webhooks/create-webhook.js';
import { DeleteWebhook } from '../../../application/automation/webhooks/delete-webhook.js';
import { WebhookQueries } from '../../../application/automation/webhooks/queries.js';
import { WebhookPolicy } from '../../../application/automation/webhooks/webhook.policy.js';
import { ProblemFilter } from '../filters/problem.filter.js';
import { ProblemPresenter } from '../presenters/problem.presenter.js';
import { WebhookPresenter } from '../presenters/webhook.presenter.js';
import {
  CreatedWebhookResponse,
  CreateWebhookBody,
  WebhookListResponse,
  WebhookParams,
} from '../schemas/webhook.schemas.js';

// Webhooks: secret URLs that other applications call (US5, FR-024).
@ApiTags('webhooks')
@ApiCookieAuth('sessionCookie')
@UseFilters(ProblemFilter)
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly createWebhook: CreateWebhook,
    private readonly deleteWebhook: DeleteWebhook,
    private readonly webhooks: WebhookQueries,
  ) {}

  @Get()
  @Can(WebhookPolicy, 'manage')
  @ApiOkResponse({ standardSchema: WebhookListResponse })
  async list(): Promise<WebhookListResponse> {
    const views = await this.webhooks.list();
    return WebhookPresenter.list(views);
  }

  @Post()
  @Can(WebhookPolicy, 'manage')
  @ApiCreatedResponse({ standardSchema: CreatedWebhookResponse })
  async create(
    @Body({ schema: CreateWebhookBody }) body: CreateWebhookBody,
    @Req() request: Request,
  ): Promise<CreatedWebhookResponse> {
    const created = await this.createWebhook.execute(body);
    const host = request.get('host') ?? '';
    const origin = `${request.protocol}://${host}`;
    return WebhookPresenter.created(created, origin);
  }

  @Delete(':id')
  @Can(WebhookPolicy, 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async delete(
    @Param({ schema: WebhookParams }) params: WebhookParams,
  ): Promise<void> {
    const result = await this.deleteWebhook.execute({ webhookId: params.id });

    if (!result.ok) throw ProblemPresenter.of(result.failure);
  }
}
