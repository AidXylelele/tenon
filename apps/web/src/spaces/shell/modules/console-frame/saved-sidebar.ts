import "server-only";
import { cookies } from "next/headers";
import { SIDEBAR_COOKIE_NAME } from "@/libs/ui/components/sidebar-cookie";
import { type Viewport, VIEWPORT_COOKIE, viewportOf } from "./viewport";

export async function savedSidebarChoice(): Promise<boolean | null> {
  const store = await cookies();
  const saved = store.get(SIDEBAR_COOKIE_NAME)?.value;

  if (saved === "true") return true;

  if (saved === "false") return false;

  return null;
}

export async function lastViewport(): Promise<Viewport | null> {
  const store = await cookies();
  const last = store.get(VIEWPORT_COOKIE)?.value;
  return viewportOf(last);
}
