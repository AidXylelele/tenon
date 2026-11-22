import { Injectable } from "@nestjs/common";
import type {
  DeliveryView,
  SubscriptionDetail,
  SubscriptionView,
} from "../../../application/automation/subscriptions/interfaces.js";
import { SubscriptionEndpointMapper } from "../mappers/subscription-endpoint.mapper.js";
import type { ResponseJson } from "../schemas/instance.schemas.js";
import type {
  SubscriptionDetailResponse,
  SubscriptionListResponse,
  SubscriptionResponse,
} from "../schemas/subscription.schemas.js";

@Injectable()
export class SubscriptionPresenter {
  constructor(
    private readonly subscriptionEndpointMapper: SubscriptionEndpointMapper,
  ) {}

  subscription(subscription: SubscriptionView): SubscriptionResponse {
    const endpoint = this.subscriptionEndpointMapper.toBody(
      subscription.endpoint,
    );
    const filter = subscription.filter as {
      with: Record<string, ResponseJson>;
    };
    return {
      id: subscription.id,
      name: subscription.name,
      endpoint,
      filter,
      createdAt: subscription.createdAt.toISOString(),
    };
  }

  list(views: readonly SubscriptionView[]): SubscriptionListResponse {
    return views.map((view) => this.subscription(view));
  }

  detail(detail: SubscriptionDetail): SubscriptionDetailResponse {
    const presented = this.subscription(detail);
    const deliveries = detail.deliveries.map((delivery) =>
      this.#deliveryOf(delivery),
    );
    return {
      id: presented.id,
      name: presented.name,
      endpoint: presented.endpoint,
      filter: presented.filter,
      createdAt: presented.createdAt,
      deliveries,
    };
  }

  #deliveryOf(
    delivery: DeliveryView,
  ): SubscriptionDetailResponse["deliveries"][number] {
    return {
      eventId: delivery.eventId,
      type: delivery.type,
      status: delivery.status,
      attempts: delivery.attempts,
      lastError: delivery.lastError,
      firstAttemptAt: delivery.firstAttemptAt?.toISOString() ?? null,
      lastAttemptAt: delivery.lastAttemptAt?.toISOString() ?? null,
    };
  }
}
