import type { StepVariant } from "language-server/protocol";
import { describe, expect, it } from "vitest";
import type { StepKind } from "./interfaces";
import { familiesOfKinds, kindInfoOf, startingVariantOf } from "./step-kinds";

const TENON_VARIANTS: readonly StepVariant[] = [
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

describe("the kinds of steps in plain words", () => {
  it("a_kind_is_given_its_label_and_description", () => {
    const info = kindInfoOf("listen");

    expect(info).toEqual({
      kind: "listen",
      label: "Wait for events",
      description: "Pause until the events arrive.",
    });
  });

  it("every_kind_is_listed_once_under_its_family", () => {
    const families = familiesOfKinds(TENON_VARIANTS);

    const grouped = families.map(({ family, label, kinds }) => {
      const listed = kinds.map(({ kind }) => kind);
      return { family, label, listed };
    });
    expect(grouped).toEqual([
      { family: "call", label: "Call a service", listed: ["call", "run"] },
      { family: "data", label: "Set data", listed: ["set"] },
      {
        family: "event",
        label: "Send or wait for events",
        listed: ["emit", "listen"],
      },
      { family: "time", label: "Wait", listed: ["wait"] },
      {
        family: "flow",
        label: "Shape the flow",
        listed: ["switch", "for", "fork", "try", "do"],
      },
      { family: "error", label: "Raise an error", listed: ["raise"] },
    ]);
  });

  it("a_kind_whose_variant_the_host_does_not_run_is_left_out_with_its_empty_family", () => {
    const variants = TENON_VARIANTS.filter(
      (variant) => variant !== "shell" && variant !== "wait",
    );

    const families = familiesOfKinds(variants);

    const grouped = families.map(({ family, kinds }) => {
      const listed = kinds.map(({ kind }) => kind);
      return { family, listed };
    });
    expect(grouped).toEqual([
      { family: "call", listed: ["call"] },
      { family: "data", listed: ["set"] },
      { family: "event", listed: ["emit", "listen"] },
      { family: "flow", listed: ["switch", "for", "fork", "try", "do"] },
      { family: "error", listed: ["raise"] },
    ]);
  });

  it.each<[StepKind, StepVariant]>([
    ["call", "http"],
    ["run", "shell"],
    ["set", "set"],
    ["emit", "emit"],
    ["listen", "listen"],
    ["wait", "wait"],
    ["switch", "switch"],
    ["for", "for"],
    ["fork", "fork"],
    ["try", "try"],
    ["do", "do"],
    ["raise", "raise"],
  ])("a_new_%s_step_starts_as_the_%s_variant", (kind, variant) => {
    const started = startingVariantOf(kind);

    expect(started).toBe(variant);
  });
});
