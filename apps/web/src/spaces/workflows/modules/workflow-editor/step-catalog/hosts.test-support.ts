import type { StepVariant } from "language-server/protocol";

export const TENON_VARIANTS: readonly StepVariant[] = [
  "http",
  "openapi",
  "grpc",
  "asyncapi",
  "mcp",
  "a2a",
  "script-js",
  "script-python",
  "shell",
  "workflow",
  "do",
  "emit",
  "for",
  "fork",
  "listen",
  "raise",
  "set",
  "switch",
  "try",
  "wait",
];

export const WITHOUT_SHELL: readonly StepVariant[] = TENON_VARIANTS.filter(
  (variant) => variant !== "shell",
);
