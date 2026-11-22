import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFromDisk, missing } from "./wasm-fetch.test-support";

async function freshFormatPython() {
  vi.resetModules();
  const { formatPython } = await import("./ruff");
  return formatPython;
}

describe("python formatted by ruff", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchFromDisk);
  });

  it("a_script_is_formatted_in_ruffs_style", async () => {
    const formatPython = await freshFormatPython();

    const formatting = await formatPython(
      "import json\nprint( json.dumps({'score':1}) )\n",
    );

    expect(formatting).toEqual({
      kind: "formatted",
      text: 'import json\n\nprint(json.dumps({"score": 1}))\n',
    });
  });

  it("a_script_that_does_not_parse_is_refused_with_ruffs_words_and_line", async () => {
    const formatPython = await freshFormatPython();

    const formatting = await formatPython(
      'import json\nscore = 1\nprint(json.dumps({"score": score})',
    );

    expect(formatting).toEqual({
      kind: "refused",
      message: "unexpected EOF while parsing",
      line: 3,
    });
  });

  it("a_ruff_that_could_not_start_is_started_again_on_the_next_request", async () => {
    const formatPython = await freshFormatPython();
    vi.stubGlobal("fetch", missing);
    const failed = formatPython("a=1");
    await expect(failed).rejects.toThrow();
    vi.stubGlobal("fetch", fetchFromDisk);

    const formatting = await formatPython("a=1");

    expect(formatting).toEqual({ kind: "formatted", text: "a = 1\n" });
  });
});
