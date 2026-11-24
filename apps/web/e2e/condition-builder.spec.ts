import { expect, test } from "@playwright/test";

const TWO_ROWS =
  "/iframe.html?id=spaces-workflows-modules-workflow-editor-condition-builder--two-rows-all-must-hold&viewMode=story";
const NON_CANONICAL =
  "/iframe.html?id=spaces-workflows-modules-workflow-editor-condition-builder--a-non-canonical-expression-opens-as-an-expression&viewMode=story";

test.describe("the condition builder playground", () => {
  test("rows_show_their_data_in_words_and_all_or_any", async ({ page }) => {
    await page.goto(TWO_ROWS);

    const first = page.getByRole("group", { name: "Condition 1" });
    const value = first.getByText("Fetch the digest › slideshow › slides");
    const all = page.getByRole("radio", { name: "All must hold" });

    await expect(value).toBeVisible();
    await expect(all).toHaveAttribute("aria-checked", "true");
  });

  test("writing_an_expression_and_back_keeps_focus_on_the_switch", async ({
    page,
  }) => {
    await page.goto(TWO_ROWS);
    const write = page.getByRole("button", { name: "Write an expression" });

    await write.focus();
    await page.keyboard.press("Enter");

    const expression = page.getByRole("textbox", {
      name: "Condition as an expression",
    });
    const builder = page.getByRole("button", { name: "Use the builder" });
    await expect(expression).toBeVisible();
    await expect(builder).toBeFocused();
  });

  test("an_expression_the_builder_cannot_show_stays_as_written", async ({
    page,
  }) => {
    await page.goto(NON_CANONICAL);

    const expression = page.getByRole("textbox", {
      name: "Condition as an expression",
    });
    const builder = page.getByRole("button", { name: "Use the builder" });
    await expect(expression).toHaveValue(
      "${ (.slideshow.slides | length) > 3 }",
    );
    await expect(builder).toHaveCount(0);
  });

  test("the_builder_renders_in_the_dark_theme_when_chosen", async ({
    page,
  }) => {
    const dark = `${TWO_ROWS}&globals=theme:dark`;
    await page.goto(dark);

    const html = page.locator("html");
    const second = page.getByRole("group", { name: "Condition 2" });
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(second).toBeVisible();
  });
});
