import type { Secret } from "@/libs/data-access/types";

export const SECRETS: readonly Secret[] = [
  {
    name: "BILLING_BASIC_PASSWORD",
    createdAt: "2026-11-20T10:00:00.000Z",
    updatedAt: "2026-11-23T15:28:00.000Z",
    usedBy: [],
  },
  {
    name: "CRM_API_TOKEN",
    createdAt: "2026-11-20T10:00:00.000Z",
    updatedAt: "2026-11-22T09:00:00.000Z",
    usedBy: [{ namespace: "sales", name: "lead-intake", version: "2.0.1" }],
  },
];
