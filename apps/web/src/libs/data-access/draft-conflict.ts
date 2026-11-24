import { z } from "zod";

const SavedDraft = z.object({
  source: z.string(),
  layout: z.record(z.string(), z.json()),
  savedBy: z.object({ id: z.string(), name: z.string() }),
  savedAt: z.string(),
});

export const DraftConflictBody = z.object({ current: SavedDraft.optional() });
