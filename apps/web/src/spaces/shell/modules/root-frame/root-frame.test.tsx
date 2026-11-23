import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RootFrame } from "./root-frame";

const jar = vi.hoisted(() => ({ theme: undefined as string | undefined }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: () => (jar.theme === undefined ? undefined : { value: jar.theme }),
    }),
}));
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-sans" }),
  Geist_Mono: () => ({ variable: "font-mono" }),
}));

describe("the root of every page", () => {
  it.each([
    ["dark", ' data-theme="dark"'],
    ["light", ' data-theme="light"'],
  ])("a_chosen_%s_theme_is_drawn_from_the_first_paint", async (theme, mark) => {
    jar.theme = theme;

    const root = await RootFrame({ children: <main /> });
    const html = renderToString(root);

    expect(html).toContain(mark);
  });

  it("the_system_theme_leaves_the_page_to_the_device", async () => {
    jar.theme = undefined;

    const root = await RootFrame({ children: <main /> });
    const html = renderToString(root);

    expect(html).not.toContain("data-theme");
  });
});
