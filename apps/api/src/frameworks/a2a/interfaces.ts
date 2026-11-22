import type { Endpoint, Failure } from "interpreter";
import type { z } from "zod";
import type { AGENT_CARD } from "./agent-card.schema.js";

export type AgentCardProperties = z.infer<typeof AGENT_CARD>;

export type Agent =
  { readonly kind: "agent"; readonly endpoint: Endpoint } | Failure;

export interface AgentOffer {
  readonly url: string;
  readonly binding: string;
  readonly version: string;
}
