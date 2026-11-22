import type { HostProfile } from "interpreter";
import { BrokerProtocol } from "../asyncapi/enums.js";

export const HOST_PROFILE: Required<HostProfile> = {
  effects: [
    "http",
    "openapi",
    "resource",
    "grpc",
    "mcp",
    "a2a",
    "asyncapi",
    "process",
    "workflow",
    "timer",
    "emit",
    "listen",
  ],
  authentications: ["basic", "bearer", "digest", "oauth2", "oidc"],
  processes: ["script", "shell"],
  scriptLanguages: ["js", "python"],
  asyncApiProtocols: Object.values(BrokerProtocol),
  mcpTransports: ["http"],
  mcpTransportOptions: [],
  schedules: ["every", "cron", "after", "on"],
  triggers: "one",
  grants: [
    "client_credentials",
    "password",
    "urn:ietf:params:oauth:grant-type:token-exchange",
  ],
  secrets: [],
};
