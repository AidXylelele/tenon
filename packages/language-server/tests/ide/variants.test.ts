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

test.each<readonly [string, HostProfile, readonly string[]]>([
  [
    "no container process leaves out the container",
    { ...profile, processes: ["script", "shell"] },
    ["container"],
  ],
  [
    "no Python leaves out the Python script",
    { ...profile, scriptLanguages: ["js"] },
    ["script-python"],
  ],
  [
    "no shell leaves out the shell command",
    { ...profile, processes: ["container", "script"] },
    ["shell"],
  ],
  [
    "no timer leaves out the wait and the try, whose retry waits between attempts",
    { ...profile, effects: effectsWithoutTimer },
    ["try", "wait"],
  ],
])("a host with %s", (_, hostProfile, missing) => {
  const variants = check(hostProfile);

  const expected = everyVariant.filter((variant) => !missing.includes(variant));
  expect(variants).toEqual(expected);
});
