import { readFile } from "node:fs/promises";
import {
  type Analyzer,
  createAnalyzer,
  type HostProfile,
} from "interpreter/front-end";

const enginePath = import.meta.resolve("jq-wasm/jq.wasm");
const engineUrl = new URL(enginePath);

const engine: Uint8Array = await readFile(engineUrl);

export const analyzer: Promise<Analyzer> = createAnalyzer(engine);

export const profile: HostProfile = {
  effects: [
    "http",
    "openapi",
    "grpc",
    "asyncapi",
    "a2a",
    "mcp",
    "process",
    "workflow",
    "timer",
    "emit",
    "listen",
    "resource",
  ],
  authentications: ["basic", "bearer", "digest", "oauth2", "oidc"],
  processes: ["container", "script", "shell"],
  scriptLanguages: ["js", "python"],
  asyncApiProtocols: ["http"],
  mcpTransports: ["http"],
  schedules: ["every", "cron", "after", "on"],
  grants: [
    "authorization_code",
    "client_credentials",
    "password",
    "refresh_token",
    "urn:ietf:params:oauth:grant-type:token-exchange",
  ],
  secrets: [],
};
