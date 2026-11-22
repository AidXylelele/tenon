import { expect, test } from "@playwright/test";

function storyOf(name: string): string {
  return `/iframe.html?id=spaces-workflows-modules-workflow-editor-step-catalog--${name}&viewMode=story`;
}

test.describe("the step catalog playground", () => {
  test("a_search_and_enter_tell_the_editor_which_step_to_add", async ({
    page,
  }) => {
    const story = storyOf("after-a-step");
    await page.goto(story);
    const search = page.getByRole("combobox", { name: "Find a kind of step" });

    await search.fill("loop");
    await search.press("Enter");

    const told = page.getByRole("status", { name: "Told the editor" });
    await expect(told).toHaveText('{"kind":"insertStep","variant":"for"}');
  });

  test("the_language_term_shows_beside_the_active_entry_only", async ({
    page,
  }) => {
    const story = storyOf("after-a-step");
    await page.goto(story);

    const fetch = page.getByRole("option", { name: "Fetch or send to a URL" });
    const choose = page.getByRole("option", { name: "Choose a path" });
    const activeTerm = fetch.getByText("call: http");
    const otherTerm = choose.getByText("switch", { exact: true });
    await expect(activeTerm).toBeVisible();
    await expect(otherTerm).toBeHidden();
  });

  test("a_term_the_search_matches_shows_beside_its_entry", async ({ page }) => {
    const story = storyOf("after-a-step");
    await page.goto(story);
    const search = page.getByRole("combobox", { name: "Find a kind of step" });

    await search.fill("call");

    const openapi = page.getByRole("option", {
      name: "Call an OpenAPI operation",
    });
    const term = openapi.getByText("call: openapi");
    await expect(term).toBeVisible();
  });

  test("every_term_shows_when_the_person_asks_for_language_terms", async ({
    page,
  }) => {
    const story = storyOf("with-language-terms");
    await page.goto(story);

    const choose = page.getByRole("option", { name: "Choose a path" });
    const term = choose.getByText("switch", { exact: true });
    await expect(term).toBeVisible();
  });
});
