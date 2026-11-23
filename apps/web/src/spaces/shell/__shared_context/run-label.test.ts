import { describe, expect, it } from "vitest";
import { runLabelOf } from "./run-label";

describe("the label of a run", () => {
  it("is_run_and_the_first_eight_characters_of_its_id", () => {
    const label = runLabelOf("7c41e2d0-5b0e-4a13-9f2b-1d2c3b4a5f6e");

    expect(label).toBe("Run 7c41e2d0");
  });
});
