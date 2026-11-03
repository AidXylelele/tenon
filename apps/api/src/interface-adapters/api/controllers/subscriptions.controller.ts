import { CurrentUser } from '@nestjs/authentication';
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
  UseFilters,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Missing } from '../../../application/automation/enums.js';
import { CreateSubscription } from '../../../application/automation/subscriptions/create-subscription.js';
import { DeleteSubscription } from '../../../application/automation/subscriptions/delete-subscription.js';
import { SubscriptionQueries } from '../../../application/automation/subscriptions/queries.js';
import { SubscriptionPolicy } from '../../../application/automation/subscriptions/subscription.policy.js';
import type { User } from '../../../domain/identity/user.js';
import { ProblemFilter } from '../filters/problem.filter.js';
import { ProblemPresenter } from '../presenters/problem.presenter.js';
import { SubscriptionEndpointMapper } from '../mappers/subscription-endpoint.mapper.js';
import { SubscriptionPresenter } from '../presenters/subscription.presenter.js';
import {
  CreateSubscriptionBody,
  SubscriptionDetailResponse,
  SubscriptionListResponse,
  SubscriptionParams,
  SubscriptionResponse,
} from '../schemas/subscription.schemas.js';

// An owner's subscriptions of their applications to events (US6, FR-025).
@ApiTags('subscriptions')
@ApiCookieAuth('sessionCookie')
@UseFilters(ProblemFilter)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly createSubscription: CreateSubscription,
    private readonly deleteSubscription: DeleteSubscription,
    private readonly subscriptions: SubscriptionQueries,
  ) {}

  @Get()
  @Can(SubscriptionPolicy, 'manage')
  @ApiOkResponse({ standardSchema: SubscriptionListResponse })
  async list(@CurrentUser() user: User): Promise<SubscriptionListResponse> {
    const views = await this.subscriptions.list(user.id);
    return SubscriptionPresenter.list(views);
  }

  @Post()
  @Can(SubscriptionPolicy, 'manage')
  @ApiCreatedResponse({ standardSchema: SubscriptionResponse })
  @ApiUnprocessableEntityResponse()
  async create(
    @Body({ schema: CreateSubscriptionBody }) body: CreateSubscriptionBody,
    @CurrentUser() user: User,
  ): Promise<SubscriptionResponse> {
    const endpoint = SubscriptionEndpointMapper.toEndpoint(body.endpoint);
    const created = await this.createSubscription.execute({
      ownerId: user.id,
      name: body.name,
      endpoint,
      filter: body.filter,
    });

    if (!created.ok) throw ProblemPresenter.ofSubscription(created.failure);

    return SubscriptionPresenter.subscription(created.value);
  }

  @Get(':id')
  @Can(SubscriptionPolicy, 'manage')
  @ApiOkResponse({ standardSchema: SubscriptionDetailResponse })
  @ApiNotFoundResponse()
  async get(
    @Param({ schema: SubscriptionParams }) params: SubscriptionParams,
    @CurrentUser() user: User,
  ): Promise<SubscriptionDetailResponse> {
    const detail = await this.subscriptions.get(user.id, params.id);

    if (detail === null) throw ProblemPresenter.of(Missing.Subscription);

    return SubscriptionPresenter.detail(detail);
  }

  @Delete(':id')
  @Can(SubscriptionPolicy, 'manage')
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

    if (!deleted.ok) throw ProblemPresenter.of(deleted.failure);
  }
}
