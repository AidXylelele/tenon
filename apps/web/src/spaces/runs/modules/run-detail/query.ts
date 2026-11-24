import { z } from "zod";

const RUN_PANELS = ["timeline", "result", "input", "events"] as const;

export type RunPanel = (typeof RUN_PANELS)[number];

export const RunQuery = z.object({
  view: z.enum(RUN_PANELS).optional().catch(undefined),
});

export function panelOf(value: string): RunPanel | null {
  return RUN_PANELS.find((panel) => panel === value) ?? null;
}
