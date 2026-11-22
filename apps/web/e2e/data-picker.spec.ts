import { expect, test } from "@playwright/test";

const AFTER_A_TEST =
  "/iframe.html?id=features-data-picker--fields-after-a-test&viewMode=story";
const SECRET_CHIP =
  "/iframe.html?id=features-data-picker-data-field--secret-reference&viewMode=story";

test.describe("the data picker playground", () => {
  test("typing_finds_a_field_of_the_last_test_run", async ({ page }) => {
    await page.goto(AFTER_A_TEST);
    const search = page.getByRole("combobox", {
      name: "Find data, or type a field name",
    });
    await expect(search).toBeFocused();

    await page.keyboard.type("slides");

    const option = page.getByRole("option", {
      name: /Fetch the digest › slideshow › slides/,
    });
    await expect(option).toBeVisible();
    await expect(page.getByRole("status")).toHaveText(/pieces of data/);
  });

  test("escape_closes_only_the_picker_and_returns_focus", async ({ page }) => {
    await page.goto(AFTER_A_TEST);
    await expect(page.getByRole("listbox")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("listbox")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Insert data" }),
    ).toBeFocused();
  });

  test("a_secret_chip_is_masked_and_reopens_the_picker", async ({ page }) => {
    await page.goto(SECRET_CHIP);
    const chip = page.getByRole("button", {
      name: "SLACK_WEBHOOK_URL, a secret kept out of run records, change",
    });
    await expect(chip).toHaveText("•••• SLACK_WEBHOOK_URL");

    await chip.click();

    await expect(page.getByRole("listbox")).toBeVisible();
  });

  test("the_picker_renders_in_the_dark_theme_when_chosen", async ({ page }) => {
    await page.goto(`${AFTER_A_TEST}&globals=theme:dark`);

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("listbox")).toBeVisible();
  });
});
