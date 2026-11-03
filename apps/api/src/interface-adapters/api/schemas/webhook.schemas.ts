import { z } from 'zod';

export const CreateWebhookBody = z.strictObject({
  name: z.string().min(1).max(120),
  eventType: z.string().min(1).max(255),
});

export type CreateWebhookBody = z.infer<typeof CreateWebhookBody>;

export const WebhookParams = z.strictObject({ id: z.uuid() });

export type WebhookParams = z.infer<typeof WebhookParams>;

export const HookParams = z.strictObject({ token: z.string().min(1).max(128) });

export type HookParams = z.infer<typeof HookParams>;

export const WebhookResponse = z.object({
  id: z.uuid(),
  name: z.string(),
  eventType: z.string(),
  createdAt: z.iso.datetime(),
});

export type WebhookResponse = z.infer<typeof WebhookResponse>;

// The only answer that shows the URL.
export const CreatedWebhookResponse = WebhookResponse.extend({
  url: z.url(),
});

export type CreatedWebhookResponse = z.infer<typeof CreatedWebhookResponse>;

export const WebhookListResponse = z.array(WebhookResponse);

export type WebhookListResponse = z.infer<typeof WebhookListResponse>;
