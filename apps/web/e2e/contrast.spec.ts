import { expect, type Page, test } from "@playwright/test";

interface Pair {
  readonly use: string;
  readonly foreground: string;
  readonly background: string;
  readonly minimum: number;
}

interface Shortfall {
  readonly use: string;
  readonly ratio: number;
  readonly minimum: number;
}

const TEXT = 4.5;
const GRAPHIC = 3;
const UNRESOLVED_TEXT = "rgb(1, 2, 3)";
const UNRESOLVED_FILL = "rgba(0, 0, 0, 0)";

const PAIRS: readonly Pair[] = [
  { use: "body text", foreground: "--text", background: "--bg", minimum: TEXT },
  {
    use: "body text in sidebar, canvas, table header",
    foreground: "--text",
    background: "--bg-subtle",
    minimum: TEXT,
  },
  {
    use: "body text in popover, menu, dialog",
    foreground: "--text",
    background: "--surface-raised",
    minimum: TEXT,
  },
  {
    use: "secondary text",
    foreground: "--text-muted",
    background: "--bg",
    minimum: TEXT,
  },
  {
    use: "secondary text in sidebar and canvas",
    foreground: "--text-muted",
    background: "--bg-subtle",
    minimum: TEXT,
  },
  {
    use: "secondary text on a hovered row",
    foreground: "--text-muted",
    background: "--hover",
    minimum: TEXT,
  },
  {
    use: "secondary text on a selected row",
    foreground: "--text-muted",
    background: "--selected",
    minimum: TEXT,
  },
  {
    use: "links, current tab",
    foreground: "--accent-text",
    background: "--bg",
    minimum: TEXT,
  },
  {
    use: "current sidebar item on its fill",
    foreground: "--accent-text",
    background: "--accent-soft",
    minimum: TEXT,
  },
  {
    use: "primary button label",
    foreground: "--on-accent",
    background: "--accent-solid",
    minimum: TEXT,
  },
  {
    use: "primary button label, hovered",
    foreground: "--on-accent",
    background: "--accent-solid-hover",
    minimum: TEXT,
  },
  {
    use: "focus ring",
    foreground: "--focus-ring",
    background: "--bg",
    minimum: GRAPHIC,
  },
  {
    use: "focus ring in sidebar and canvas",
    foreground: "--focus-ring",
    background: "--bg-subtle",
    minimum: GRAPHIC,
  },
  {
    use: "focus ring on dialogs and menus",
    foreground: "--focus-ring",
    background: "--surface-raised",
    minimum: GRAPHIC,
  },
  {
    use: "focus ring on a hovered row",
    foreground: "--focus-ring",
    background: "--hover",
    minimum: GRAPHIC,
  },
  {
    use: "focus ring next to a current fill",
    foreground: "--focus-ring",
    background: "--accent-soft",
    minimum: GRAPHIC,
  },
  {
    use: "focus ring on a selected row",
    foreground: "--focus-ring",
    background: "--selected",
    minimum: GRAPHIC,
  },
  {
    use: "boundary of inputs, selects, checkboxes",
    foreground: "--control-border",
    background: "--surface",
    minimum: GRAPHIC,
  },
  {
    use: "connectors on the canvas",
    foreground: "--flow-edge",
    background: "--bg-subtle",
    minimum: GRAPHIC,
  },
  {
    use: "selected step outline",
    foreground: "--flow-selected",
    background: "--bg-subtle",
    minimum: GRAPHIC,
  },
  {
    use: "success word and icon",
    foreground: "--success-text",
    background: "--bg",
    minimum: TEXT,
  },
  {
    use: "success word on a step card",
    foreground: "--success-text",
    background: "--surface",
    minimum: TEXT,
  },
  {
    use: "success banner text",
    foreground: "--success-strong",
    background: "--success-soft",
    minimum: TEXT,
  },
  {
    use: "success banner icon",
    foreground: "--success-text",
    background: "--success-soft",
    minimum: GRAPHIC,
  },
  {
    use: "success bar in the runs chart",
    foreground: "--success-chart",
    background: "--surface",
    minimum: GRAPHIC,
  },
  {
    use: "warning word and icon",
    foreground: "--warning-text",
    background: "--bg",
    minimum: TEXT,
  },
  {
    use: "warning word on a step card",
    foreground: "--warning-text",
    background: "--surface",
    minimum: TEXT,
  },
  {
    use: "warning banner text",
    foreground: "--warning-strong",
    background: "--warning-soft",
    minimum: TEXT,
  },
  {
    use: "warning banner icon",
    foreground: "--warning-text",
    background: "--warning-soft",
    minimum: GRAPHIC,
  },
  {
    use: "warning bar in the runs chart",
    foreground: "--warning-chart",
    background: "--surface",
    minimum: GRAPHIC,
  },
  {
    use: "danger word and icon",
    foreground: "--danger-text",
    background: "--bg",
    minimum: TEXT,
  },
  {
    use: "danger word on a step card",
    foreground: "--danger-text",
    background: "--surface",
    minimum: TEXT,
  },
  {
    use: "danger banner text",
    foreground: "--danger-strong",
    background: "--danger-soft",
    minimum: TEXT,
  },
  {
    use: "destructive button label on its soft fill",
    foreground: "--danger-text",
    background: "--danger-soft",
    minimum: TEXT,
  },
  {
    use: "danger bar in the runs chart",
    foreground: "--danger-chart",
    background: "--surface",
    minimum: GRAPHIC,
  },
  {
    use: "info word and icon",
    foreground: "--info-text",
    background: "--bg",
    minimum: TEXT,
  },
  {
    use: "runs count in the sidebar",
    foreground: "--info-text",
    background: "--bg-subtle",
    minimum: TEXT,
  },
  {
    use: "runs count on a hovered sidebar item",
    foreground: "--info-strong",
    background: "--hover",
    minimum: TEXT,
  },
  {
    use: "runs count on a pressed sidebar item",
    foreground: "--info-strong",
    background: "--selected",
    minimum: TEXT,
  },
  {
    use: "info word on a step card",
    foreground: "--info-text",
    background: "--surface",
    minimum: TEXT,
  },
  {
    use: "info banner text",
    foreground: "--info-strong",
    background: "--info-soft",
    minimum: TEXT,
  },
  {
    use: "info banner icon",
    foreground: "--info-text",
    background: "--info-soft",
    minimum: GRAPHIC,
  },
  {
    use: "info bar in the runs chart",
    foreground: "--info-chart",
    background: "--surface",
    minimum: GRAPHIC,
  },
  {
    use: "cancelled bar in the runs chart",
    foreground: "--neutral-chart",
    background: "--surface",
    minimum: GRAPHIC,
  },
  {
    use: "YAML keys, JS keywords",
    foreground: "--code-keyword",
    background: "--surface",
    minimum: TEXT,
  },
  {
    use: "strings",
    foreground: "--code-string",
    background: "--surface",
    minimum: TEXT,
  },
  {
    use: "numbers, booleans",
    foreground: "--code-number",
    background: "--surface",
    minimum: TEXT,
  },
  {
    use: "properties, functions",
    foreground: "--code-property",
    background: "--surface",
    minimum: TEXT,
  },
  {
    use: "comments",
    foreground: "--code-comment",
    background: "--surface",
    minimum: TEXT,
  },
  {
    use: "expressions",
    foreground: "--code-expression",
    background: "--surface",
    minimum: TEXT,
  },
];

function channelsOf(color: string): readonly number[] {
  const match = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(color);

  if (match === null) throw new Error(`${color} is not an opaque sRGB colour.`);

  return match.slice(1).map(Number);
}

function linearOf(channel: number): number {
  const unit = channel / 255;

  if (unit <= 0.04045) return unit / 12.92;

  return ((unit + 0.055) / 1.055) ** 2.4;
}

function luminanceOf(color: string): number {
  const [red = 0, green = 0, blue = 0] = channelsOf(color).map(linearOf);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function ratioOf(foreground: string, background: string): number {
  const lighter = Math.max(luminanceOf(foreground), luminanceOf(background));
  const darker = Math.min(luminanceOf(foreground), luminanceOf(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function resolvedColorsOf(page: Page): Promise<[string, string][]> {
  return page.evaluate(
    ({ pairs, unresolved }) =>
      pairs.map(({ foreground, background }) => {
        const probe = document.createElement("div");
        probe.style.setProperty("color", `var(${foreground})`);
        probe.style.setProperty("background-color", `var(${background})`);
        const parent = document.createElement("div");
        parent.style.color = unresolved;
        parent.append(probe);
        document.body.append(parent);
        const style = getComputedStyle(probe);
        const resolved: [string, string] = [style.color, style.backgroundColor];
        parent.remove();
        return resolved;
      }),
    { pairs: PAIRS, unresolved: UNRESOLVED_TEXT },
  );
}

function shortfallsOf(colors: readonly [string, string][]): Shortfall[] {
  return PAIRS.flatMap((pair, index) => {
    const [foreground = UNRESOLVED_TEXT, background = UNRESOLVED_FILL] =
      colors[index] ?? [];
    const unresolved =
      foreground === UNRESOLVED_TEXT || background === UNRESOLVED_FILL;
    const ratio = unresolved ? 0 : ratioOf(foreground, background);
    const short = ratio < pair.minimum;
    return short ? [{ use: pair.use, ratio, minimum: pair.minimum }] : [];
  });
}

for (const theme of ["light", "dark"]) {
  test(`every_pair_of_the_contrast_table_meets_wcag_aa_in_the_${theme}_theme`, async ({
    page,
  }) => {
    await page.goto(
      `/iframe.html?id=design-system-colour--tokens&viewMode=story&globals=theme:${theme}`,
    );
    const root = page.locator("html");
    await expect(root).toHaveAttribute("data-theme", theme);

    const colors = await resolvedColorsOf(page);

    const shortfalls = shortfallsOf(colors);
    expect(shortfalls).toEqual([]);
  });
}
