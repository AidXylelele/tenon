import type {
  DeliveryView,
  SubscriptionDetail,
  SubscriptionView,
} from '../../../application/automation/subscriptions/queries.js';
import type { DeliveryEndpoint } from '../../../domain/automation/subscriptions/interfaces.js';
import type { Subscription } from '../../../domain/automation/subscriptions/subscription.js';
import type {
  CreateSubscriptionBody,
  SubscriptionDetailResponse,
  SubscriptionListResponse,
  SubscriptionResponse,
} from '../schemas/subscription.schemas.js';
import type { ResponseJson } from '../schemas/instance.schemas.js';

type EndpointBody = CreateSubscriptionBody['endpoint'];

// A subscription names the secret its deliveries authenticate with, never its value.
export class SubscriptionPresenter {
  static endpointOf(body: EndpointBody): DeliveryEndpoint {
    const authentication = body.authentication;
    return {
      uri: body.uri,
      scheme: authentication?.scheme ?? null,
      secret: authentication?.secret ?? null,
    };
  }

  static subscription(
    subscription: Subscription | SubscriptionView,
  ): SubscriptionResponse {
    const endpoint = SubscriptionPresenter.#endpoint(subscription.endpoint);
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

  static list(views: readonly SubscriptionView[]): SubscriptionListResponse {
    return views.map((view) => SubscriptionPresenter.subscription(view));
  }

  static detail(detail: SubscriptionDetail): SubscriptionDetailResponse {
    const subscription = SubscriptionPresenter.subscription(detail);
    const deliveries = detail.deliveries.map((delivery) =>
      SubscriptionPresenter.#delivery(delivery),
    );
    return {
      id: subscription.id,
      name: subscription.name,
      endpoint: subscription.endpoint,
      filter: subscription.filter,
      createdAt: subscription.createdAt,
      deliveries,
    };
  }

  static #endpoint(endpoint: DeliveryEndpoint): EndpointBody {
    if (endpoint.scheme === null || endpoint.secret === null)
      return { uri: endpoint.uri };

    return {
      uri: endpoint.uri,
      authentication: { scheme: endpoint.scheme, secret: endpoint.secret },
    };
  }

  static #delivery(delivery: DeliveryView) {
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
