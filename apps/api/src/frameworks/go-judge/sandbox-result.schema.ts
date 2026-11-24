import { z } from "zod";

const SANDBOX_RESULT = z.looseObject({
  status: z.string(),
  exitStatus: z.number().default(0),
  files: z.record(z.string(), z.string()).default({}),
});

export const SANDBOX_RESULTS = z.tuple([SANDBOX_RESULT], SANDBOX_RESULT);

export const SANDBOX_REFUSAL = z.string();
