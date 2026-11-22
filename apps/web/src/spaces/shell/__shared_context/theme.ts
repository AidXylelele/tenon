export type Theme = "light" | "dark" | "system";

const THEMES: readonly Theme[] = ["light", "dark", "system"];

export const THEME_COOKIE = "theme";

export function themeOf(value: string | undefined): Theme {
  return THEMES.find((theme) => theme === value) ?? "system";
}

export function themeAttributeOf(theme: Theme): "light" | "dark" | undefined {
  if (theme === "system") return undefined;

  return theme;
}
