import type { AnalysisOptions } from "../../src/api/index.js";
import {
  type HostProfile,
  type Program,
  type StartContext,
  type State,
  createInterpreter,
} from "../../src/index.js";

export const fullProfile: HostProfile = {
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
  asyncApiProtocols: ["amqp", "http", "kafka", "ws"],
  mcpTransports: ["http", "stdio"],
  schedules: ["every", "cron", "after", "on"],
  grants: [
    "authorization_code",
    "client_credentials",
    "password",
    "refresh_token",
    "urn:ietf:params:oauth:grant-type:token-exchange",
  ],
  secrets: ["mySecret"],
};

export const fullOptions: AnalysisOptions = {
  profile: fullProfile,
  imports: {},
};

export const startContext: StartContext = {
  instance: "instance-1",
  now: 1767225600000,
  secrets: {},
  runtime: { name: "interpreter-tests", version: "1.0.0", metadata: {} },
};

export const interpreter = await createInterpreter();

export function programOf(
  source: string,
  options: AnalysisOptions = fullOptions,
): Program {
  const compilation = interpreter.compile(source, options);

  if (compilation.kind === "refused") {
    const diagnostics = JSON.stringify(compilation.diagnostics);
    throw new Error(`The interpreter refused the document: ${diagnostics}`);
  }

  return compilation.program;
}

export function restored(state: State): State {
  const text = JSON.stringify(state);

  return JSON.parse(text) as State;
}
