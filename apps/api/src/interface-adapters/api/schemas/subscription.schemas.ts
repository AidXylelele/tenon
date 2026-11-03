import { z } from 'zod';
import { DeliveryStatus } from '../../../application/automation/subscriptions/enums.js';
import { DeliveryScheme } from '../../../domain/automation/subscriptions/enums.js';

const EndpointBody = z.strictObject({
  uri: z.url({ protocol: /^https?$/ }),
  authentication: z
    .strictObject({
      scheme: z.enum(DeliveryScheme),
      secret: z.string().min(1),
    })
    .optional(),
});

// The standard's event filter: CloudEvent attributes as literals, patterns or expressions.
const FilterBody = z.strictObject({
  with: z
    .record(z.string(), z.json())
    .refine((attributes) => Object.keys(attributes).length > 0),
});

export const CreateSubscriptionBody = z.strictObject({
  name: z.string().min(1).max(120),
  endpoint: EndpointBody,
  filter: FilterBody,
});

export type CreateSubscriptionBody = z.infer<typeof CreateSubscriptionBody>;

export const SubscriptionParams = z.strictObject({ id: z.uuid() });

export type SubscriptionParams = z.infer<typeof SubscriptionParams>;

export const SubscriptionResponse = z.object({
  id: z.uuid(),
  name: z.string(),
  endpoint: EndpointBody,
  filter: z.object({ with: z.record(z.string(), z.json()) }),
  createdAt: z.iso.datetime(),
});

export type SubscriptionResponse = z.infer<typeof SubscriptionResponse>;

export const DeliveryResponse = z.object({
  eventId: z.string(),
  type: z.string(),
  status: z.enum(DeliveryStatus),
  attempts: z.number().int(),
  lastError: z.string().nullable(),
  firstAttemptAt: z.iso.datetime().nullable(),
  lastAttemptAt: z.iso.datetime().nullable(),
});

export const SubscriptionDetailResponse = SubscriptionResponse.extend({
  deliveries: z.array(DeliveryResponse),
});

export type SubscriptionDetailResponse = z.infer<
  typeof SubscriptionDetailResponse
>;

export const SubscriptionListResponse = z.array(SubscriptionResponse);

export type SubscriptionListResponse = z.infer<typeof SubscriptionListResponse>;
