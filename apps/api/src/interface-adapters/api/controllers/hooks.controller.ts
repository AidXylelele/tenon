import { Public } from '@nestjs/authentication';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiNotFoundResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { IncomingHttpHeaders } from 'node:http';
import { ReceiveWebhookCall } from '../../../application/automation/webhooks/receive-webhook-call.js';
import { WebhookToken } from '../../../domain/automation/webhooks/webhook-token.js';
import { ProblemFilter } from '../filters/problem.filter.js';
import { WebhookCallMapper } from '../mappers/webhook-call.mapper.js';
import { ProblemPresenter } from '../presenters/problem.presenter.js';
import { HookParams } from '../schemas/webhook.schemas.js';

// The URL other applications call, without signing in: the token is the credential. A body
// above the limit is refused by the body parser (413) before any event is accepted.
@ApiTags('webhooks')
@UseFilters(ProblemFilter)
@Controller('hooks')
export class HooksController {
  constructor(private readonly receiveWebhookCall: ReceiveWebhookCall) {}

  @Post(':token')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse()
  @ApiNotFoundResponse()
  @ApiPayloadTooLargeResponse()
  async call(
    @Param({ schema: HookParams }) params: HookParams,
    @Query() query: Record<string, unknown>,
    @Headers() headers: IncomingHttpHeaders,
    @Body() body: unknown,
  ): Promise<void> {
    const token = new WebhookToken(params.token);
    const call = WebhookCallMapper.toCall(body, query, headers);
    const result = await this.receiveWebhookCall.execute({ token, call });

    if (!result.ok) throw ProblemPresenter.of(result.failure);
  }
}
