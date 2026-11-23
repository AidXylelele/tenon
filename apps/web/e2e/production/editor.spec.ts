import { expect, type Page, test } from "@playwright/test";
import { API_STUB_PORT } from "./ports";

const SESSION = { name: "console_session", value: "stub", path: "/" };

async function signedIn(page: Page, baseURL: string | undefined) {
  const domain = new URL(baseURL ?? "http://localhost").hostname;
  await page.context().addCookies([{ ...SESSION, domain }]);
}

async function openStep(page: Page, name: string) {
  await page.goto("/workflows/sales/digest/edit");
  const flow = page.getByRole("region", { name: "The workflow's flow" });
  const card = flow.getByRole("group", { name: new RegExp(name) });
  await card.getByRole("button").first().click();
  await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
}

test.describe("the editor page of the production build", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await signedIn(page, baseURL);
  });

  test("javascript_is_formatted_by_prettier_under_the_page's_policy", async ({
    page,
  }) => {
    const refused: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy"))
        refused.push(message.text());
    });
    await openStep(page, "Normalize names");
    const field = page.getByRole("group", { name: "Code" });

    await field.getByRole("button", { name: "Format" }).click();

    await expect(field.getByText("Formatted with Prettier")).toBeVisible();
    await expect(field.getByRole("textbox", { name: "Code" })).toContainText(
      'const names = ["ada", "grace"];',
    );
    expect(refused).toEqual([]);
  });

  test("python_is_formatted_by_ruff_under_the_page's_policy", async ({
    page,
  }) => {
    const refused: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy"))
        refused.push(message.text());
    });
    await openStep(page, "Score a lead");
    const field = page.getByRole("group", { name: "Code" });

    await field.getByRole("button", { name: "Format" }).click();

    await expect(field.getByText("Formatted with Ruff")).toBeVisible();
    await expect(field.getByRole("textbox", { name: "Code" })).toContainText(
      'print(json.dumps({"score": 7}))',
    );
    expect(refused).toEqual([]);
  });

  test("an_edit_survives_crossing_1024_px_in_the_text_and_the_draft", async ({
    page,
  }) => {
    const kept = "# kept across the resize";
    const draft = `http://localhost:${String(API_STUB_PORT)}/api/v1/workflows/sales/digest/draft`;
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/workflows/sales/digest/edit");
    await page.getByRole("radio", { name: "Code" }).click();
    const text = page.getByRole("textbox", { name: /Code view/ });
    await text.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type(`\n${kept}`);

    await page.setViewportSize({ width: 900, height: 800 });
    await expect(text).toContainText(kept);
    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(text).toContainText(kept);
    await expect(async () => {
      const saved = await page.request.get(draft);
      const body: unknown = await saved.json();
      expect(JSON.stringify(body)).toContain(kept);
    }).toPass();
  });
});
