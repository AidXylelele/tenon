import { z } from "zod";

export const HostProfileResponse = z.object({
  effects: z.array(z.string()),
  authentications: z.array(z.string()),
  processes: z.array(z.string()),
  scriptLanguages: z.array(z.string()),
  asyncApiProtocols: z.array(z.string()),
  mcpTransports: z.array(z.string()),
  mcpTransportOptions: z.array(z.string()),
  schedules: z.array(z.string()),
  triggers: z.string(),
  grants: z.array(z.string()),
  shell: z.object({
    platform: z.string(),
    shell: z.string(),
    commands: z.array(z.string()),
  }),
  limits: z.object({
    callSeconds: z.number().int(),
    processSeconds: z.number().int(),
    responseBytes: z.number().int(),
  }),
  lifecycleEvents: z.array(
    z.object({ name: z.string(), types: z.array(z.string()) }),
  ),
});

export type HostProfileResponse = z.infer<typeof HostProfileResponse>;
