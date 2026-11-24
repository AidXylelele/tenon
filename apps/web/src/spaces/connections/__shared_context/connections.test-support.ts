import type {
  Read,
  Subscription,
  SubscriptionDetail,
  Webhook,
} from "@/libs/data-access/types";

export const WEBHOOKS: readonly Webhook[] = [
  {
    id: "wh-1",
    name: "Order approvals",
    eventType: "com.example.order.approved.v1",
    createdAt: "2026-11-20T10:00:00.000Z",
  },
  {
    id: "wh-2",
    name: "Sign-ups from the website",
    eventType: "com.example.signup.created.v1",
    createdAt: "2026-11-22T15:28:00.000Z",
  },
];

const ON_CALL: Subscription = {
  id: "ae769898-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
  name: "Failed runs to the on-call channel",
  endpoint: { uri: "https://httpbin.org/anything/on-call" },
  filter: {
    with: { type: "org.open-workflow-specification.workflow.faulted.v1" },
  },
  createdAt: "2026-11-23T15:28:00.000Z",
};

const BILLING: Subscription = {
  id: "bf870909-2d3e-4f6a-9b0c-1d2e3f4a5b6c",
  name: "Invoices to billing",
  endpoint: {
    uri: "https://billing.example.com/hooks/tenon",
    authentication: { scheme: "bearer", secret: "BILLING_TOKEN" },
  },
  filter: { with: { type: "com.example.invoice.sent.v1", source: "/billing" } },
  createdAt: "2026-11-21T09:00:00.000Z",
};

export const SUBSCRIPTIONS: readonly Subscription[] = [ON_CALL, BILLING];

export const ON_CALL_DETAIL: Read<SubscriptionDetail> = {
  ...ON_CALL,
  deliveries: [
    {
      eventId: "3f2a91c0-0001",
      type: "org.open-workflow-specification.workflow.faulted.v1",
      status: "delivered",
      attempts: 1,
      lastError: null,
      lastAttemptAt: "2026-11-23T15:28:23.000Z",
    },
    {
      eventId: "3f2a91c0-0002",
      type: "org.open-workflow-specification.workflow.faulted.v1",
      status: "pending",
      attempts: 3,
      lastError: "The address answered 503",
      lastAttemptAt: "2026-11-23T15:40:00.000Z",
    },
  ],
  readAt: Date.parse("2026-11-23T15:41:00.000Z"),
};
