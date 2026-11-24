import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFromDisk, missing } from "./wasm-fetch.test-support";

async function freshRuff() {
  vi.resetModules();
  return import("./ruff");
}

describe("python formatted by ruff", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchFromDisk);
  });

  it("a_script_is_formatted_in_ruffs_style", async () => {
    const { formatPython } = await freshRuff();

    const formatting = await formatPython(
      "import json\nprint( json.dumps({'score':1}) )\n",
      0,
    );

    expect(formatting).toEqual({
      kind: "formatted",
      text: 'import json\n\nprint(json.dumps({"score": 1}))\n',
      cursor: 0,
    });
  });

  it("a_script_that_does_not_parse_is_refused_with_ruffs_words_and_line", async () => {
    const { formatPython } = await freshRuff();

    const formatting = await formatPython(
      'import json\nscore = 1\nprint(json.dumps({"score": score})',
      0,
    );

    expect(formatting).toEqual({
      kind: "refused",
      message: "unexpected EOF while parsing",
      line: 3,
    });
  });

  it("a_ruff_that_could_not_start_is_started_again_on_the_next_request", async () => {
    const { formatPython } = await freshRuff();
    vi.stubGlobal("fetch", missing);
    const failed = formatPython("a=1", 0);
    await expect(failed).rejects.toThrow();
    vi.stubGlobal("fetch", fetchFromDisk);

    const formatting = await formatPython("a=1", 0);

    expect(formatting).toEqual({
      kind: "formatted",
      text: "a = 1\n",
      cursor: 0,
    });
  });

  it("the_cursor_keeps_its_line_and_column", async () => {
    const { formatPython } = await freshRuff();

    const formatting = await formatPython("a=1\nb=2", 6);

    expect(formatting).toEqual({
      kind: "formatted",
      text: "a = 1\nb = 2\n",
      cursor: 8,
    });
  });

  it("a_script_that_parses_has_no_problems", async () => {
    const { checkPython } = await freshRuff();

    const problems = await checkPython("import json\nprint(json.dumps(1))\n");

    expect(problems).toEqual([]);
  });

  it("a_script_that_does_not_parse_has_ruffs_words_at_a_line_of_the_text", async () => {
    const { checkPython } = await freshRuff();

    const problems = await checkPython(
      'import json\nscore = 1\nprint(json.dumps({"score": score})\n',
    );

    expect(problems).toEqual([
      {
        line: 4,
        message: "unexpected EOF while parsing",
        severity: "error",
      },
    ]);
  });
});
