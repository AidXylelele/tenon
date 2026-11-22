import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("class names merged with the design system's utilities", () => {
  it.each([
    [
      "text-caption text-muted-foreground",
      "text-caption text-muted-foreground",
    ],
    [
      "text-body font-semibold text-faint",
      "text-body font-semibold text-faint",
    ],
    ["text-title text-foreground", "text-title text-foreground"],
    [
      "font-mono text-code text-accent-text",
      "font-mono text-code text-accent-text",
    ],
    [
      "border border-border shadow-overlay",
      "border border-border shadow-overlay",
    ],
  ])(
    "a_size_or_shadow_of_the_design_survives_a_colour_in_%s",
    (classes, kept) => {
      const merged = cn(classes);

      expect(merged).toBe(kept);
    },
  );

  it.each([
    ["text-caption text-body", "text-body"],
    ["text-sm text-caption", "text-caption"],
    ["shadow-overlay shadow-dialog", "shadow-dialog"],
    ["shadow-dialog shadow-none", "shadow-none"],
    ["ease-standard ease-linear", "ease-linear"],
    ["animate-live animate-spin", "animate-spin"],
    ["tracking-caps tracking-wide", "tracking-wide"],
  ])("a_later_utility_of_the_same_kind_wins_in_%s", (classes, kept) => {
    const merged = cn(classes);

    expect(merged).toBe(kept);
  });
});
