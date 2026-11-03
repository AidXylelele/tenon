// What a use case did not find; the presentation turns the code into a message.
export enum Missing {
  Workflow = 'workflow.not-found',
  Version = 'version.not-found',
  Instance = 'instance.not-found',
  // A deleted webhook and an unknown URL are the same miss (FR-024).
  Webhook = 'webhook.not-found',
  Secret = 'secret.not-found',
  Subscription = 'subscription.not-found',
}
