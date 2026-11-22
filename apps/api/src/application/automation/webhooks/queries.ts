import type { WebhookView } from "./interfaces.js";

export abstract class WebhookQueries {
  abstract list(): Promise<WebhookView[]>;
}
