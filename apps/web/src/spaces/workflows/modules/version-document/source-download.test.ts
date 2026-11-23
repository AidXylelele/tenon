import { beforeEach, describe, expect, it, vi } from "vitest";
import { sourceDownload } from "./source-download";

const { versionSource, versionDocument } = vi.hoisted(() => ({
  versionSource: vi.fn<(...args: unknown[]) => Promise<string | null>>(),
  versionDocument: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/libs/data-access/automation", () => ({
  versionSource,
  versionDocument,
}));

const PARAMS = { namespace: "sales", name: "order-router", version: "1.2.0" };

describe("downloading a version", () => {
  beforeEach(() => {
    versionSource.mockReset();
    versionDocument.mockReset();
  });

  it("the_yaml_comes_as_an_attachment_named_for_the_version", async () => {
    versionSource.mockResolvedValue("do: []\n");

    const answer = await sourceDownload(PARAMS);

    expect(answer.status).toBe(200);
    expect(answer.headers.get("content-type")).toBe(
      "application/yaml; charset=utf-8",
    );
    expect(answer.headers.get("content-disposition")).toBe(
      'attachment; filename="order-router-1.2.0.yaml"',
    );
    expect(await answer.text()).toBe("do: []\n");
  });

  it("a_version_without_its_text_comes_as_its_json_document", async () => {
    versionSource.mockResolvedValue(null);
    versionDocument.mockResolvedValue({ do: [] });

    const answer = await sourceDownload(PARAMS);

    expect(answer.headers.get("content-disposition")).toBe(
      'attachment; filename="order-router-1.2.0.json"',
    );
    expect(await answer.json()).toEqual({ do: [] });
  });

  it("an_unknown_version_is_not_found", async () => {
    versionSource.mockResolvedValue(null);
    versionDocument.mockResolvedValue(null);

    const answer = await sourceDownload(PARAMS);

    expect(answer.status).toBe(404);
  });
});

describe("downloading while Tenon does not answer", () => {
  it("answers_503", async () => {
    const { ApiError } = await import("@/libs/data-access/http");
    versionSource.mockRejectedValue(new ApiError(503, "down"));

    const answer = await sourceDownload(PARAMS);

    expect(answer.status).toBe(503);
  });
});
