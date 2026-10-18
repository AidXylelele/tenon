import type { WebhookEndpointView } from '../../../application/interfaces.js';
import type {
  WebhookEndpointListResponse,
  WebhookEndpointResponse,
} from '../dto/automation-responses.dto.js';

export class WebhookEndpointPresenter {
  static endpoint(
    view: WebhookEndpointView,
    baseUrl: string,
  ): WebhookEndpointResponse {
    return {
      nodeId: view.nodeId,
      url: new URL(`api/v1/webhooks/${view.endpointId}`, `${baseUrl}/`).href,
      methods: [...(view.settings?.methods ?? [])],
      authentication: view.settings?.authentication ?? null,
      secret: view.secret,
    };
  }

  static list(
    views: readonly WebhookEndpointView[],
    baseUrl: string,
  ): WebhookEndpointListResponse {
    return {
      items: views.map((view) =>
        WebhookEndpointPresenter.endpoint(view, baseUrl),
      ),
    };
  }
}
