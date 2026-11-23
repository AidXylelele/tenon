import { expect, test } from "@playwright/test";

const TO_FILL =
  "/iframe.html?id=spaces-workflows-modules-workflow-editor-step-form--http-address-to-fill&viewMode=story";
const SCHEDULE =
  "/iframe.html?id=spaces-workflows-modules-workflow-editor-step-form-start-form--schedule&viewMode=story";
const DARK_SCHEDULE = `${SCHEDULE}&globals=theme:dark`;

test.describe("the step form playground", () => {
  test("an_address_to_fill_turns_into_its_error_once_left", async ({
    page,
  }) => {
    await page.goto(TO_FILL);
    const address = page.getByLabel("Address");
    const fill = page.getByText("Fill in", { exact: true });
    await expect(fill).toBeVisible();

    await address.focus();
    await page.keyboard.press("Tab");

    const error = page.getByRole("alert");
    await expect(error).toHaveText(
      "Enter the address to call, for example https://api.example.com/orders",
    );
    await expect(address).toHaveAttribute("aria-invalid", "true");
  });

  test("more_options_open_from_the_keyboard_and_keep_focus", async ({
    page,
  }) => {
    await page.goto(TO_FILL);
    const more = page.getByRole("button", { name: "More options" });
    const headers = page.getByLabel(/Headers/);
    await expect(headers).toBeHidden();

    await more.focus();
    await page.keyboard.press("Enter");

    await expect(headers).toBeVisible();
    await expect(more).toBeFocused();
  });

  test("a_schedule_is_said_in_utc_with_the_viewer's_time", async ({ page }) => {
    await page.goto(SCHEDULE);

    const utc = page.getByText("Every day at 09:00 UTC");
    const local = page.getByText("11:00 your time, Europe/Kyiv");
    const nextStarts = page.getByText("Next starts");

    await expect(utc).toBeVisible();
    await expect(local).toBeVisible();
    await expect(nextStarts).toBeVisible();
  });

  test("the_start_form_renders_in_the_dark_theme_when_chosen", async ({
    page,
  }) => {
    await page.goto(DARK_SCHEDULE);

    const root = page.locator("html");
    const way = page.getByRole("radio", { name: "On a schedule" });

    await expect(root).toHaveAttribute("data-theme", "dark");
    await expect(way).toBeChecked();
  });
});
