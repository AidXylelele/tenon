import type { z } from "zod";
import type { SANDBOX_RESULTS } from "./sandbox-result.schema.js";

export type SandboxResult = z.infer<typeof SANDBOX_RESULTS>[0];
