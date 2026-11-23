export type Viewport = "narrow" | "wide";

export const VIEWPORT_COOKIE = "viewport";

const VIEWPORTS: readonly Viewport[] = ["narrow", "wide"];

export function viewportOf(value: string | undefined): Viewport | null {
  const known = VIEWPORTS.find((viewport) => viewport === value);
  return known ?? null;
}
