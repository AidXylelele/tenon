import { describe, expect, it } from "vitest";
import { formatJavaScript } from "./prettier";

describe("javascript formatted by prettier", () => {
  it("a_script_is_formatted_in_prettiers_style", async () => {
    const formatting = await formatJavaScript(
      "const result = people.map((person) => ({ ...person, name: person.name.trim().toLowerCase() }));",
    );

    expect(formatting).toEqual({
      kind: "formatted",
      text: "const result = people.map((person) => ({\n  ...person,\n  name: person.name.trim().toLowerCase(),\n}));\n",
    });
  });

  it("a_script_that_does_not_parse_is_refused_with_prettiers_words_and_line", async () => {
    const formatting = await formatJavaScript(
      "const total = 1;\nconst a = (1;",
    );

    expect(formatting).toEqual({
      kind: "refused",
      message: 'Unexpected token, expected "," (2:13)',
      line: 2,
    });
  });

  it("a_script_too_deeply_nested_for_prettier_fails_with_its_error", async () => {
    const nested = `x = ${"[".repeat(50000)}${"]".repeat(50000)}`;

    const formatting = formatJavaScript(nested);

    await expect(formatting).rejects.toThrow(RangeError);
  });
});
