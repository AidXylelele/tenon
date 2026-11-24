import "server-only";
import { cookies } from "next/headers";
import { type Theme, THEME_COOKIE, themeOf } from "./theme";

export async function chosenTheme(): Promise<Theme> {
  const store = await cookies();
  const value = store.get(THEME_COOKIE)?.value;
  return themeOf(value);
}
