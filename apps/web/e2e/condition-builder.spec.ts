import { expect, test } from "@playwright/test";

const TWO_ROWS =
  "/iframe.html?id=spaces-workflows-modules-workflow-editor-condition-builder--two-rows-all-must-hold&viewMode=story";
const NON_CANONICAL =
  "/iframe.html?id=spaces-workflows-modules-workflow-editor-condition-builder--a-non-canonical-expression-opens-as-an-expression&viewMode=story";

test.describe("the condition builder playground", () => {
  test("rows_show_their_data_in_words_and_all_or_any", async ({ page }) => {
    await page.goto(TWO_ROWS);

    const first = page.getByRole("group", { name: "Condition 1" });
    await expect(
      first.getByText("Fetch the digest › slideshow › slides"),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "All must hold" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  test("writing_an_expression_and_back_keeps_focus_on_the_switch", async ({
    page,
  }) => {
    await page.goto(TWO_ROWS);
    const write = page.getByRole("button", { name: "Write an expression" });

    await write.focus();
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("textbox", { name: "Condition as an expression" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Use the builder" }),
    ).toBeFocused();
  });

  test("an_expression_the_builder_cannot_show_stays_as_written", async ({
    page,
  }) => {
    await page.goto(NON_CANONICAL);

    await expect(
      page.getByRole("textbox", { name: "Condition as an expression" }),
    ).toHaveValue("${ (.slideshow.slides | length) > 3 }");
    await expect(
      page.getByRole("button", { name: "Use the builder" }),
    ).toHaveCount(0);
  });

  test("the_builder_renders_in_the_dark_theme_when_chosen", async ({
    page,
  }) => {
    await page.goto(`${TWO_ROWS}&globals=theme:dark`);

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(
      page.getByRole("group", { name: "Condition 2" }),
    ).toBeVisible();
  });
});
