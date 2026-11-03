import type { CreatedWebhook } from '../../../application/automation/webhooks/ports.js';
import type { WebhookView } from '../../../application/automation/webhooks/queries.js';
import type {
  CreatedWebhookResponse,
  WebhookListResponse,
  WebhookResponse,
} from '../schemas/webhook.schemas.js';

export class WebhookPresenter {
  private static readonly HOOKS = '/api/v1/hooks/';

  // The URL is the API's own origin, as the caller reached it, and the token.
  static created(
    created: CreatedWebhook,
    origin: string,
  ): CreatedWebhookResponse {
    const webhook = created.webhook;
    const url = `${origin}${WebhookPresenter.HOOKS}${created.token.value}`;
    return {
      id: webhook.id,
      name: webhook.name,
      eventType: webhook.eventType,
      createdAt: webhook.createdAt.toISOString(),
      url,
    };
  }

  static list(views: readonly WebhookView[]): WebhookListResponse {
    return views.map((view) => WebhookPresenter.#view(view));
  }

  static #view(view: WebhookView): WebhookResponse {
    return {
      id: view.id,
      name: view.name,
      eventType: view.eventType,
      createdAt: view.createdAt.toISOString(),
    };
  }
}
