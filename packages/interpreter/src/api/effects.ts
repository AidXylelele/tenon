import type { EffectOutcome } from "./outcomes.js";
import type { EffectRequest } from "./requests.js";

export type EffectKind =
  | "http"
  | "openapi"
  | "grpc"
  | "asyncapi"
  | "a2a"
  | "mcp"
  | "process"
  | "workflow"
  | "timer"
  | "emit"
  | "listen"
  | "resource";

export type EffectId = string;

interface EffectCommon {
  readonly id: EffectId;
  readonly deadline: number | null;
}

export type Effect = EffectCommon & EffectRequest;

export interface EffectResponse {
  readonly id: EffectId;
  readonly outcome: EffectOutcome;
}
