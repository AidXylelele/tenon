import { Injectable } from "@nestjs/common";
import type {
  CreatedWebhook,
  WebhookView,
} from "../../../application/automation/webhooks/interfaces.js";
import type {
  CreatedWebhookResponse,
  WebhookListResponse,
  WebhookResponse,
} from "../schemas/webhook.schemas.js";
import { ApiRoute } from "../enums.js";

@Injectable()
export class WebhookPresenter {
  private static readonly HOOKS = `${ApiRoute.Prefix}/hooks/`;

  readonly #apiBase: string;

  constructor(apiBaseUrl: string) {
    const rooted = apiBaseUrl.endsWith("/");
    this.#apiBase = rooted ? apiBaseUrl : `${apiBaseUrl}/`;
  }

  created(created: CreatedWebhook): CreatedWebhookResponse {
    const path = `${WebhookPresenter.HOOKS}${created.token}`;
    const url = new URL(path, this.#apiBase).href;
    return {
      id: created.id,
      name: created.name,
      eventType: created.eventType,
      createdAt: created.createdAt.toISOString(),
      url,
    };
  }

  list(views: readonly WebhookView[]): WebhookListResponse {
    return views.map((view) => this.#webhookOf(view));
  }

  #webhookOf(view: WebhookView): WebhookResponse {
    return {
      id: view.id,
      name: view.name,
      eventType: view.eventType,
      createdAt: view.createdAt.toISOString(),
    };
  }
}
