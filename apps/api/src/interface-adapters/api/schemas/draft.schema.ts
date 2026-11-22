import { z } from "zod";

export const DraftLayout = z.record(z.string(), z.json());

export type DraftLayout = z.infer<typeof DraftLayout>;

export const DraftBody = z.strictObject({
  source: z.string(),
  layout: DraftLayout,
});

export type DraftBody = z.infer<typeof DraftBody>;

export const DraftResponse = z.object({
  source: z.string(),
  layout: DraftLayout,
  savedBy: z.object({ id: z.uuid(), name: z.string() }),
  savedAt: z.iso.datetime(),
});

export type DraftResponse = z.infer<typeof DraftResponse>;

export const DraftConflictResponse = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  current: DraftResponse.optional(),
});

export const TestRunBody = z.strictObject({ input: z.json().default({}) });

export type TestRunBody = z.infer<typeof TestRunBody>;

export const TestRunFingerprint = TestRunBody.or(z.unknown());
