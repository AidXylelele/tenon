import {
  type Analysis,
  type ast,
  type JsonObject,
  standardVersion,
} from "interpreter/front-end";
import { yamlOf } from "../yaml-text/index.js";
import { startingContentOf } from "./contents.js";

export const stepVariants = Object.freeze([
  "http",
  "openapi",
  "grpc",
  "asyncapi",
  "mcp",
  "a2a",
  "script-js",
  "script-python",
  "shell",
  "container",
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
] as const);

export type StepVariant = (typeof stepVariants)[number];

const probeHeader: JsonObject = {
  dsl: standardVersion,
  namespace: "catalog",
  name: "variant",
  version: "0.1.0",
};

export function supportedVariantsOf(
  analyze: (text: string) => Analysis,
): readonly StepVariant[] {
  return stepVariants.filter((variant) => isSupported(variant, analyze));
}

function isSupported(
  variant: StepVariant,
  analyze: (text: string) => Analysis,
): boolean {
  const probe = probeOf(variant);
  const analysis = analyze(probe);
  const codes = analysis.diagnostics.map((diagnostic) => diagnostic.code);

  return !codes.includes("capability");
}

function probeOf(variant: StepVariant): string {
  const content = startingContentOf(variant);
  const step = { [variant]: content };
  const document = { document: probeHeader, do: [step] };

  return yamlOf(document);
}

export function variantOf(task: ast.Task): StepVariant | null {
  switch (task.kind) {
    case "call":
      return calledVariantOf(task.call);
    case "run":
      return runVariantOf(task.process);
    case "do":
    case "emit":
    case "for":
    case "fork":
    case "listen":
    case "raise":
    case "set":
    case "switch":
    case "try":
    case "wait":
      return task.kind;
  }
}

function calledVariantOf(call: ast.Call): StepVariant | null {
  switch (call.kind) {
    case "function":
      return null;
    case "http":
    case "openapi":
    case "grpc":
    case "asyncapi":
    case "mcp":
    case "a2a":
      return call.kind;
  }
}

function runVariantOf(process: ast.Process): StepVariant {
  switch (process.kind) {
    case "script":
      return scriptVariantOf(process.language);
    case "shell":
    case "container":
    case "workflow":
      return process.kind;
  }
}

function scriptVariantOf(language: ast.ScriptProcess["language"]): StepVariant {
  switch (language) {
    case "js":
      return "script-js";
    case "python":
      return "script-python";
  }
}
