import { AutomationPolicy } from "../auth/automation.policy.js";
import { Can } from "@nestjs/authorization";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CreateWebhook } from "../../../application/automation/webhooks/create-webhook.js";
import { DeleteWebhook } from "../../../application/automation/webhooks/delete-webhook.js";
import { WebhookQueries } from "../../../application/automation/webhooks/queries.js";
import { ProblemPresenter } from "../presenters/problem.presenter.js";
import { WebhookPresenter } from "../presenters/webhook.presenter.js";
import {
  CreatedWebhookResponse,
  CreateWebhookBody,
  WebhookListResponse,
  WebhookParams,
} from "../schemas/webhook.schema.js";

@ApiTags("webhooks")
@ApiCookieAuth("sessionCookie")
@Controller("webhooks")
export class WebhooksController {
  constructor(
    private readonly createWebhook: CreateWebhook,
    private readonly deleteWebhook: DeleteWebhook,
    private readonly webhooks: WebhookQueries,
    private readonly webhookPresenter: WebhookPresenter,
    private readonly problemPresenter: ProblemPresenter,
  ) {}

  @Get()
  @Can(AutomationPolicy, "change")
  @ApiOkResponse({ standardSchema: WebhookListResponse })
  async list(): Promise<WebhookListResponse> {
    const views = await this.webhooks.list();
    return this.webhookPresenter.list(views);
  }

  @Post()
  @Can(AutomationPolicy, "change")
  @ApiCreatedResponse({ standardSchema: CreatedWebhookResponse })
  async create(
    @Body({ schema: CreateWebhookBody }) body: CreateWebhookBody,
  ): Promise<CreatedWebhookResponse> {
    const created = await this.createWebhook.execute(body);
    return this.webhookPresenter.created(created);
  }

  @Delete(":id")
  @Can(AutomationPolicy, "change")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async delete(
    @Param({ schema: WebhookParams }) params: WebhookParams,
  ): Promise<void> {
    const result = await this.deleteWebhook.execute({ webhookId: params.id });

    if (!result.ok) throw this.problemPresenter.of(result.failure);
  }
}
