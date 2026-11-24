import { HOME_HREF } from "@/libs/routing/routes";

export function returnPath(next: string | undefined): string {
  const start = HOME_HREF;

  if (!next?.startsWith("/")) return start;

  const base = "http://console.invalid";
  let url: URL;

  try {
    url = new URL(next, base);
  } catch {
    return start;
  }

  if (url.origin !== base) return start;

  const path = `${url.pathname}${url.search}${url.hash}`;

  if (path.startsWith("//")) return start;

  return path;
}
