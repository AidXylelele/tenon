import { expect, type Page, test } from "@playwright/test";

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
});
