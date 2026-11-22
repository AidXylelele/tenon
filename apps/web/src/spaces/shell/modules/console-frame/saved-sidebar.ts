import "server-only";
import { cookies } from "next/headers";

const SIDEBAR_COOKIE = "sidebar_state";

export async function savedSidebarChoice(): Promise<boolean | null> {
  const store = await cookies();
  const saved = store.get(SIDEBAR_COOKIE)?.value;

  if (saved === "true") return true;

  if (saved === "false") return false;

  return null;
}
