import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/libs/data-access/http";
import { testRunProgress } from "./test-run-progress";

const { instance, taskRecords } = vi.hoisted(() => ({
  instance: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  taskRecords: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/libs/data-access/automation", () => ({ instance, taskRecords }));

const RUN = "9b2f6a4e-7c1d-4f3a-9e8b-2d5c6a7b8c9d";
const PARAMS = { namespace: "sales", name: "digest", run: RUN };

describe("reading a test run's progress", () => {
  beforeEach(() => {
    instance.mockReset();
    taskRecords.mockReset();
  });

  it("the_run_comes_with_its_step_records_and_is_never_cached", async () => {
    const run = { id: RUN, phase: "running" };
    const record = { reference: "/do/0/fetch", status: "completed" };
    instance.mockResolvedValue(run);
    taskRecords.mockResolvedValue({ items: [record], next: null });

    const answer = await testRunProgress(PARAMS);

    expect(answer.status).toBe(200);
    expect(answer.headers.get("cache-control")).toBe("private, no-store");
    expect(await answer.json()).toEqual({ run, records: [record] });
    expect(instance).toHaveBeenCalledWith(RUN);
  });

  it("a_run_that_is_not_there_is_not_found", async () => {
    instance.mockResolvedValue(null);
    taskRecords.mockResolvedValue({ items: [], next: null });

    const answer = await testRunProgress(PARAMS);

    expect(answer.status).toBe(404);
  });

  it("an_id_that_is_no_run_id_is_not_found_without_asking_the_api", async () => {
    const answer = await testRunProgress({ ...PARAMS, run: "not-a-run" });

    expect(answer.status).toBe(404);
    expect(instance).not.toHaveBeenCalled();
  });

  it("an_api_that_does_not_answer_is_unavailable", async () => {
    instance.mockRejectedValue(new ApiError(503, "down"));
    taskRecords.mockResolvedValue({ items: [], next: null });

    const answer = await testRunProgress(PARAMS);

    expect(answer.status).toBe(503);
  });
});
