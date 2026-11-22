import { AutomationPolicy } from "../auth/automation.policy.js";
import { CurrentUser } from "@nestjs/authentication";
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
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { Missing } from "../../../application/automation/enums.js";
import { CreateSubscription } from "../../../application/automation/subscriptions/create-subscription.js";
import { DeleteSubscription } from "../../../application/automation/subscriptions/delete-subscription.js";
import { SubscriptionQueries } from "../../../application/automation/subscriptions/queries.js";
import type { User } from "../../../domain/identity/user.js";
import { ProblemPresenter } from "../presenters/problem.presenter.js";
import { SubscriptionEndpointMapper } from "../mappers/subscription-endpoint.mapper.js";
import { SubscriptionPresenter } from "../presenters/subscription.presenter.js";
import {
  CreateSubscriptionBody,
  SubscriptionDetailResponse,
  SubscriptionListResponse,
  SubscriptionParams,
  SubscriptionResponse,
} from "../schemas/subscription.schemas.js";

@ApiTags("subscriptions")
@ApiCookieAuth("sessionCookie")
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(
    private readonly createSubscription: CreateSubscription,
    private readonly deleteSubscription: DeleteSubscription,
    private readonly subscriptions: SubscriptionQueries,
    private readonly subscriptionPresenter: SubscriptionPresenter,
    private readonly subscriptionEndpointMapper: SubscriptionEndpointMapper,
    private readonly problemPresenter: ProblemPresenter,
  ) {}

  @Get()
  @Can(AutomationPolicy, "change")
  @ApiOkResponse({ standardSchema: SubscriptionListResponse })
  async list(@CurrentUser() user: User): Promise<SubscriptionListResponse> {
    const views = await this.subscriptions.list(user.id);
    return this.subscriptionPresenter.list(views);
  }

  @Post()
  @Can(AutomationPolicy, "change")
  @ApiCreatedResponse({ standardSchema: SubscriptionResponse })
  @ApiUnprocessableEntityResponse()
  async create(
    @Body({ schema: CreateSubscriptionBody }) body: CreateSubscriptionBody,
    @CurrentUser() user: User,
  ): Promise<SubscriptionResponse> {
    const endpoint = this.subscriptionEndpointMapper.toEndpoint(body.endpoint);
    const created = await this.createSubscription.execute({
      ownerId: user.id,
      name: body.name,
      endpoint,
      filter: body.filter,
    });

    if (!created.ok)
      throw this.problemPresenter.ofSubscription(created.failure);

    return this.subscriptionPresenter.subscription(created.value);
  }

  @Get(":id")
  @Can(AutomationPolicy, "change")
  @ApiOkResponse({ standardSchema: SubscriptionDetailResponse })
  @ApiNotFoundResponse()
  async get(
    @Param({ schema: SubscriptionParams }) params: SubscriptionParams,
    @CurrentUser() user: User,
  ): Promise<SubscriptionDetailResponse> {
    const detail = await this.subscriptions.get(user.id, params.id);

    if (detail === null) throw this.problemPresenter.of(Missing.Subscription);

    return this.subscriptionPresenter.detail(detail);
  }

  @Delete(":id")
  @Can(AutomationPolicy, "change")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async delete(
    @Param({ schema: SubscriptionParams }) params: SubscriptionParams,
    @CurrentUser() user: User,
  ): Promise<void> {
    const deleted = await this.deleteSubscription.execute({
      ownerId: user.id,
      subscriptionId: params.id,
    });

    if (!deleted.ok) throw this.problemPresenter.of(deleted.failure);
  }
}
