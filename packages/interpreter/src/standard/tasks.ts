export const taskKinds = Object.freeze([
  "call",
  "do",
  "emit",
  "for",
  "fork",
  "listen",
  "raise",
  "run",
  "set",
  "switch",
  "try",
  "wait",
] as const);
export type TaskKind = (typeof taskKinds)[number];

export const callProtocols = [
  "asyncapi",
  "grpc",
  "http",
  "openapi",
  "a2a",
  "mcp",
] as const;
export type CallProtocol = (typeof callProtocols)[number];

export const processKinds = [
  "container",
  "script",
  "shell",
  "workflow",
] as const;
export type ProcessKind = (typeof processKinds)[number];

export const extensionTargets = [
  "call",
  "composite",
  "emit",
  "for",
  "listen",
  "raise",
  "run",
  "set",
  "switch",
  "try",
  "wait",
  "all",
] as const;
export type ExtensionTarget = (typeof extensionTargets)[number];

export function extensionTargetsOf(kind: TaskKind): readonly ExtensionTarget[] {
  switch (kind) {
    case "do":
    case "fork":
      return ["composite", "all"];
    case "call":
    case "emit":
    case "for":
    case "listen":
    case "raise":
    case "run":
    case "set":
    case "switch":
    case "try":
    case "wait":
      return [kind, "all"];
  }
}

export const scriptLanguages = ["js", "python"] as const;
export type ScriptLanguage = (typeof scriptLanguages)[number];

export const standardVersion = "1.1.0";

export const dslVersions = ["1.0", "1.1"] as const;
