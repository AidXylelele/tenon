import type { HostProfile } from "@/libs/data-access/types";

export const PROFILE: HostProfile = {
  effects: ["http", "openapi", "grpc", "asyncapi", "mcp", "a2a"],
  authentications: ["basic", "bearer", "oauth2"],
  processes: ["script", "shell", "workflow"],
  scriptLanguages: ["js", "python"],
  asyncApiProtocols: ["kafka", "mqtt"],
  mcpTransports: ["http"],
  schedules: ["every", "cron", "after", "on"],
  triggers: "one",
  mcpTransportOptions: [],
  grants: [],
  lifecycleEvents: [],
  shell: { platform: "linux", shell: "sh", commands: ["date", "echo", "jq"] },
  limits: { callSeconds: 30, processSeconds: 60, responseBytes: 5_242_880 },
};
