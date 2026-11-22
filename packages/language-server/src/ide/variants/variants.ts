import {
  type Analysis,
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
