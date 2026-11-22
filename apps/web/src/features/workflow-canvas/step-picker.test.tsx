import { fireEvent, render, screen } from "@testing-library/react";
import type { StepVariant } from "language-server/protocol";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StepPicker } from "./step-picker";

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

function openWith(variants: readonly StepVariant[]) {
  const onPick = vi.fn<(variant: StepVariant) => void>();
  render(
    <StepPicker
      open
      onOpenChange={vi.fn()}
      variants={variants}
      onPick={onPick}
    />,
  );
  return onPick;
}

describe("the picker of the next task", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it.each<[string, StepVariant, RegExp]>([
    ["a_service_call", "http", /^Call a service/],
    ["a_run", "shell", /^Run a script or workflow/],
    ["a_wait", "wait", /Pause for a while/],
  ])("picking_%s_adds_the_%s_variant", (_, variant, option) => {
    const onPick = openWith(TENON_VARIANTS);
    const picked = screen.getByRole("option", { name: option });

    fireEvent.click(picked);

    expect(onPick).toHaveBeenCalledWith(variant);
  });

  it("a_kind_whose_variant_the_host_does_not_run_is_not_offered", () => {
    const variants = TENON_VARIANTS.filter((variant) => variant !== "shell");
    openWith(variants);

    const run = screen.queryByRole("option", {
      name: /^Run a script or workflow/,
    });

    expect(run).not.toBeInTheDocument();
  });
});
