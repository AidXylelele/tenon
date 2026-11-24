import { expect, test } from "@playwright/test";

function storyOf(name: string): string {
  return `/iframe.html?id=libs-code-formatting--${name}&viewMode=story`;
}

test.describe("scripts formatted in a worker under the worker policy", () => {
  test("javascript_is_formatted_by_prettier", async ({ page }) => {
    const story = storyOf("java-script");
    await page.goto(story);

    const outcome = page.getByRole("status", { name: "Formatting" });
    const formatted = JSON.stringify({
      kind: "formatted",
      text: "const total = [1, 2].map((n) => n * 2);\n",
      cursor: 0,
    });
    await expect(outcome).toHaveText(formatted);
  });

  test("python_is_formatted_by_ruff", async ({ page }) => {
    const story = storyOf("python");
    await page.goto(story);

    const outcome = page.getByRole("status", { name: "Formatting" });
    const formatted = JSON.stringify({
      kind: "formatted",
      text: 'import json\n\nprint(json.dumps({"score": 1}))\n',
      cursor: 0,
    });
    await expect(outcome).toHaveText(formatted);
  });

  test("python_that_does_not_parse_is_refused_with_ruffs_words_and_line", async ({
    page,
  }) => {
    const story = storyOf("python-that-does-not-parse");
    await page.goto(story);

    const outcome = page.getByRole("status", { name: "Formatting" });
    const refused = JSON.stringify({
      kind: "refused",
      message: "unexpected EOF while parsing",
      line: 3,
    });
    await expect(outcome).toHaveText(refused);
  });

  test("python_is_checked_by_ruff_with_its_words_at_their_line", async ({
    page,
  }) => {
    const story = storyOf("python-checked");
    await page.goto(story);

    const outcome = page.getByRole("status", { name: "Checking" });
    const checked = JSON.stringify([
      { line: 3, message: "unexpected EOF while parsing", severity: "error" },
    ]);
    await expect(outcome).toHaveText(checked);
  });
});
