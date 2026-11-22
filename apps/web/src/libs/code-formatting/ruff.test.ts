import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { formatPython } from "./ruff";

async function fetchFromDisk(url: URL): Promise<Response> {
  const bytes = await readFile(url);
  const headers = { "Content-Type": "application/wasm" };
  return new Response(bytes, { headers });
}

describe("python formatted by ruff", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", fetchFromDisk);
  });

  it("a_script_is_formatted_in_ruffs_style", async () => {
    const formatting = await formatPython(
      "import json\nprint( json.dumps({'score':1}) )\n",
    );

    expect(formatting).toEqual({
      kind: "formatted",
      text: 'import json\n\nprint(json.dumps({"score": 1}))\n',
    });
  });

  it("a_script_that_does_not_parse_is_refused_with_ruffs_words_and_line", async () => {
    const formatting = await formatPython(
      'import json\nscore = 1\nprint(json.dumps({"score": score})',
    );

    expect(formatting).toEqual({
      kind: "refused",
      message: "unexpected EOF while parsing",
      line: 3,
    });
  });
});
