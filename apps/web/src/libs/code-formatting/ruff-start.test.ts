import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { formatPython } from "./ruff";

function missing(): Promise<Response> {
  const response = new Response(null, { status: 404 });
  return Promise.resolve(response);
}

async function fetchFromDisk(url: URL): Promise<Response> {
  const bytes = await readFile(url);
  const headers = { "Content-Type": "application/wasm" };
  return new Response(bytes, { headers });
}

describe("starting ruff", () => {
  it("a_ruff_that_could_not_start_is_started_again_on_the_next_request", async () => {
    vi.stubGlobal("fetch", missing);
    await formatPython("a=1").catch(() => undefined);
    vi.stubGlobal("fetch", fetchFromDisk);

    const formatting = await formatPython("a=1");

    expect(formatting).toEqual({ kind: "formatted", text: "a = 1\n" });
  });
});
