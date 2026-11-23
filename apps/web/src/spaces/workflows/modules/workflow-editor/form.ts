import { z } from "zod";

export const NamingFields = z.object({
  namespace: z.string().trim().min(1, "Give the workflow a namespace."),
  name: z.string().trim().min(1, "Give the workflow a name."),
  version: z.string().trim().min(1, "Give the first version a number."),
});

export type NamingFields = z.infer<typeof NamingFields>;

export const ImportAddress = z.url({ protocol: /^https?$/ }).max(2048);

export const DraftTarget = z.object({
  namespace: z.string().min(1),
  name: z.string().min(1),
});

const EntityTag = z.string().min(1);

export const DraftSave = DraftTarget.extend({
  source: z.string(),
  layout: z.record(z.string(), z.json()),
  etag: EntityTag.nullable(),
});

export const DraftStart = DraftTarget.extend({ source: z.string() });

export type DraftStart = z.infer<typeof DraftStart>;

export const DraftEtag = DraftTarget.extend({ etag: EntityTag });

export const PublishedVersion = z.object({
  document: z.object({ version: z.string() }),
});

export const DraftTest = DraftEtag.extend({ input: z.json() });

export const RunId = z.uuid();

export const StartsTurn = DraftTarget.extend({ on: z.boolean() });

export const TestEventType = z.string().trim().min(1).max(256);
