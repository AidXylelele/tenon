import { expect, test } from "@playwright/test";

function storyOf(name: string): string {
  return `/iframe.html?id=features-script-field--${name}&viewMode=story`;
}

test.describe("the script field playground", () => {
  test("format_rewrites_javascript_with_prettier_in_the_worker", async ({
    page,
  }) => {
    const story = storyOf("java-script-formatted");
    await page.goto(story);

    const told = page.getByRole("status");
    const code = page.getByRole("textbox", { name: "Code" });
    await expect(told).toHaveText("Formatted with Prettier");
    await expect(code).toHaveText(
      "const ids = people.map((p) => p.id);console.log(JSON.stringify(ids));",
    );
  });

  test("ruff_refuses_python_that_does_not_parse_and_says_where", async ({
    page,
  }) => {
    const story = storyOf("python-with-a-problem");
    await page.goto(story);

    const told = page.getByRole("status");
    const problem = page.getByText("Line 3: “(” was never closed");
    await expect(told).toHaveText(
      "Fix line 3 first: unexpected EOF while parsing. Ruff formats only code that parses.",
    );
    await expect(problem).toBeVisible();
  });

  test("shift_alt_f_formats_the_code", async ({ page }) => {
    const story = storyOf("expanded");
    await page.goto(story);
    const code = page.getByRole("textbox", { name: "Code" });
    await code.click();

    await code.press("Shift+Alt+KeyF");

    const told = page.getByRole("status");
    await expect(told).toHaveText("Formatted with Ruff");
  });

  test("an_expanded_field_gives_the_code_more_room", async ({ page }) => {
    const story = storyOf("expanded");
    await page.goto(story);

    const code = page.getByRole("textbox", { name: "Code" });
    const box = await code.boundingBox();
    const height = box?.height ?? 0;
    expect(height).toBeGreaterThanOrEqual(400);
  });
});
