import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Transactional } from '@nestjs-cls/transactional';
import { ListWebhookEndpoints } from '../../../application/use-cases/list-webhook-endpoints.js';
import { RotateWebhookSecret } from '../../../application/use-cases/rotate-webhook-secret.js';
import type { User } from '../../../domain/user.js';
import {
  WebhookEndpointListResponse,
  WebhookEndpointResponse,
} from '../dto/automation-responses.dto.js';
import { WebhookEndpointPresenter } from '../presenters/webhook-endpoint.presenter.js';
import { PUBLIC_BASE_URL } from '../public-base-url.js';

@ApiTags('workflows')
@ApiCookieAuth('sessionCookie')
@Controller('workflows/:id/webhooks')
export class WebhookEndpointsController {
  constructor(
    private readonly listWebhookEndpoints: ListWebhookEndpoints,
    private readonly rotateWebhookSecret: RotateWebhookSecret,
    @Inject(PUBLIC_BASE_URL) private readonly baseUrl: string,
  ) {}

  @Get()
  @Can.Anyone()
  @ApiOkResponse({ type: WebhookEndpointListResponse })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async list(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<WebhookEndpointListResponse> {
    const views = await this.listWebhookEndpoints.execute({
      actor: user,
      workflowId: id,
    });
    return WebhookEndpointPresenter.list(views, this.baseUrl);
  }

  @Post(':nodeId/secret')
  @Can.Anyone()
  @Transactional()
  @HttpCode(200)
  @ApiOkResponse({ type: WebhookEndpointResponse })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async rotate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @CurrentUser() user: User,
  ): Promise<WebhookEndpointResponse> {
    const view = await this.rotateWebhookSecret.execute({
      actor: user,
      workflowId: id,
      nodeId,
    });
    return WebhookEndpointPresenter.endpoint(view, this.baseUrl);
  }
}
