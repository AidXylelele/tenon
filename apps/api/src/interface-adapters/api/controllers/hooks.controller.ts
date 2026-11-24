import { Public } from "@nestjs/authentication";
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiNotFoundResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { IncomingHttpHeaders } from "node:http";
import { ReceiveWebhookCall } from "../../../application/automation/webhooks/receive-webhook-call.js";
import { WebhookToken } from "../../../domain/automation/webhooks/webhook-token.js";
import { WebhookCallMapper } from "../mappers/webhook-call.mapper.js";
import { ProblemPresenter } from "../presenters/problem.presenter.js";
import { HookParams } from "../schemas/webhook.schema.js";

@ApiTags("webhooks")
@Controller("hooks")
export class HooksController {
  constructor(
    private readonly receiveWebhookCall: ReceiveWebhookCall,
    private readonly webhookCallMapper: WebhookCallMapper,
    private readonly problemPresenter: ProblemPresenter,
  ) {}

  @Post(":token")
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
    const call = this.webhookCallMapper.toCall(body, query, headers);
    const result = await this.receiveWebhookCall.execute({ token, call });

    if (!result.ok) throw this.problemPresenter.of(result.failure);
  }
}
