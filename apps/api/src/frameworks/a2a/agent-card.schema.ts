import { z } from "zod";

export const AGENT_CARD = z.object({
  url: z.string().nullable().default(null),
  protocolVersion: z.string().default("0.3.0"),
  preferredTransport: z.string().default("JSONRPC"),
  additionalInterfaces: z
    .array(z.object({ url: z.string(), transport: z.string() }))
    .default([]),
  supportedInterfaces: z
    .array(
      z.object({
        url: z.string(),
        protocolBinding: z.string(),
        protocolVersion: z.string(),
      }),
    )
    .default([]),
  security: z.array(z.unknown()).default([]),
  securityRequirements: z.array(z.unknown()).default([]),
});
