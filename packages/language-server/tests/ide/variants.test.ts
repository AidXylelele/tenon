import type { HostProfile } from "interpreter/front-end";
import { expect, test } from "vitest";
import { supportedVariantsOf } from "../../src/ide/variants/index.js";
import { analyzer, profile } from "../support/analyzer.js";

const created = await analyzer;

const everyVariant = [
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
];

const effectsWithoutTimer: HostProfile["effects"] = [
  "http",
  "openapi",
  "grpc",
  "asyncapi",
  "a2a",
  "mcp",
  "process",
  "workflow",
  "emit",
  "listen",
  "resource",
];

function check(hostProfile: HostProfile) {
  const options = { profile: hostProfile, imports: {} };
  const analyze = (text: string) => created.analyze(text, options);

  return supportedVariantsOf(analyze);
}

test("a host that runs everything supports every variant, in the catalogue's order", () => {
  const variants = check(profile);

  expect(variants).toEqual(everyVariant);
});

test.each<readonly [string, HostProfile, string]>([
  [
    "no container process",
    { ...profile, processes: ["script", "shell"] },
    "container",
  ],
  ["no Python", { ...profile, scriptLanguages: ["js"] }, "script-python"],
  ["no shell", { ...profile, processes: ["container", "script"] }, "shell"],
  ["no timer", { ...profile, effects: effectsWithoutTimer }, "wait"],
])("a host with %s leaves out %s", (_, hostProfile, missing) => {
  const variants = check(hostProfile);

  const expected = everyVariant.filter((variant) => variant !== missing);
  expect(variants).toEqual(expected);
});
