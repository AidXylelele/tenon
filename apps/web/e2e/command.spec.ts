import { expect, test } from "@playwright/test";

const STORY =
  "/iframe.html?id=design-system-components-command--open&viewMode=story";

test.describe("the search of the console", () => {
  test("the_focused_search_rings_its_whole_field_not_the_text_inside", async ({
    page,
  }) => {
    await page.goto(STORY);
    const search = page.getByRole("combobox");
    const field = page.locator('[data-slot="input-group"]', { has: search });

    await search.focus();

    await expect(field).toHaveCSS("outline-style", "solid");
    await expect(search).toHaveCSS("outline-width", "0px");
  });

  test("the_search_names_the_option_enter_takes_on_open_and_after_typing", async ({
    page,
  }) => {
    await page.goto(STORY);
    const search = page.getByRole("combobox");
    const highlighted = page.getByRole("option", { selected: true });
    const first = await highlighted.getAttribute("id");
    await expect(search).toHaveAttribute("aria-activedescendant", first ?? "");

    await search.fill("run");

    await expect(highlighted).toHaveText("Runs");
    const matching = await highlighted.getAttribute("id");
    await expect(search).toHaveAttribute(
      "aria-activedescendant",
      matching ?? "",
    );
  });
});
