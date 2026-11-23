import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/libs/data-access/http";
import { publishedSteps } from "./published-steps";

const { versionStructure } = vi.hoisted(() => ({
  versionStructure: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/libs/data-access/automation", () => ({ versionStructure }));

const PARAMS = { namespace: "sales", name: "digest", version: "1.0.0" };

describe("reading the steps of the published version", () => {
  beforeEach(() => {
    versionStructure.mockReset();
  });

  it("the_steps_of_the_version_come_as_json", async () => {
    const steps = { id: "/do", pointer: "/do", role: "sequence", steps: [] };
    versionStructure.mockResolvedValue({ steps });

    const answer = await publishedSteps(PARAMS);

    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual(steps);
    expect(versionStructure).toHaveBeenCalledWith("sales", "digest", "1.0.0");
  });

  it("a_version_that_is_not_there_is_not_found", async () => {
    versionStructure.mockResolvedValue(null);

    const answer = await publishedSteps(PARAMS);

    expect(answer.status).toBe(404);
  });

  it("an_api_that_does_not_answer_is_unavailable", async () => {
    versionStructure.mockRejectedValue(new ApiError(503, "down"));

    const answer = await publishedSteps(PARAMS);

    expect(answer.status).toBe(503);
  });
});
