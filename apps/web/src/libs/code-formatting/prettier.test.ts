import { describe, expect, it } from "vitest";
import { checkJavaScript, formatJavaScript } from "./prettier";

describe("javascript formatted by prettier", () => {
  it("a_script_is_formatted_in_prettiers_style", async () => {
    const formatting = await formatJavaScript(
      "const result = people.map((person) => ({ ...person, name: person.name.trim().toLowerCase() }));",
      0,
    );

    expect(formatting).toEqual({
      kind: "formatted",
      text: "const result = people.map((person) => ({\n  ...person,\n  name: person.name.trim().toLowerCase(),\n}));\n",
      cursor: 0,
    });
  });

  it("a_script_that_does_not_parse_is_refused_with_prettiers_words_and_line", async () => {
    const formatting = await formatJavaScript(
      "const total = 1;\nconst a = (1;",
      0,
    );

    expect(formatting).toEqual({
      kind: "refused",
      message: 'Unexpected token, expected "," (2:13)',
      line: 2,
    });
  });

  it("a_script_too_deeply_nested_for_prettier_fails_with_its_error", async () => {
    const nested = `x = ${"[".repeat(50000)}${"]".repeat(50000)}`;

    const formatting = formatJavaScript(nested, 0);

    await expect(formatting).rejects.toThrow(RangeError);
  });

  it("the_cursor_stays_on_the_code_it_was_at", async () => {
    const formatting = await formatJavaScript("a=1;b=2", 4);

    expect(formatting).toEqual({
      kind: "formatted",
      text: "a = 1;\nb = 2;\n",
      cursor: 7,
    });
  });

  it("a_script_that_parses_has_no_problems", async () => {
    const problems = await checkJavaScript("const a = 1;");

    expect(problems).toEqual([]);
  });

  it("a_script_that_does_not_parse_has_prettiers_words_at_their_line", async () => {
    const problems = await checkJavaScript("const total = 1;\nconst a = (1;");

    expect(problems).toEqual([
      {
        line: 2,
        message: 'Unexpected token, expected "," (2:13)',
        severity: "error",
      },
    ]);
  });
});
