export interface WebhookView {
  readonly id: string;
  readonly name: string;
  readonly eventType: string;
  readonly createdAt: Date;
}

export abstract class WebhookQueries {
  // Every webhook, newest first.
  abstract list(): Promise<WebhookView[]>;
}
