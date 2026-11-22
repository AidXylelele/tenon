import { describe, expect, it } from "vitest";
import type { Phase } from "@/libs/data-access/types";
import { isUnended } from "./vocabulary";

describe("a run that has not ended", () => {
  it.each([
    ["pending", true],
    ["running", true],
    ["waiting", true],
    ["suspended", true],
    ["completed", false],
    ["faulted", false],
    ["cancelled", false],
  ] as const)("a_%s_run_is_unended_%s", (phase: Phase, unended) => {
    expect(isUnended(phase)).toBe(unended);
  });
});
