"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSessionCookieSecure } from "@/libs/data-access/environment";
import { signOut } from "@/libs/data-access/identity";
import { signInHref } from "@/libs/routing/routes";
import { THEME_COOKIE, themeOf } from "../../__shared_context/theme";

const YEAR_S = 365 * 24 * 60 * 60;

export async function signOutAction(): Promise<void> {
  await signOut();
  const signIn = signInHref({ reason: "signed-out" });
  redirect(signIn);
}

export async function keepThemeAction(chosen: string): Promise<void> {
  const theme = themeOf(chosen);
  const store = await cookies();
  const secure = isSessionCookieSecure();
  store.set(THEME_COOKIE, theme, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: YEAR_S,
  });
}
