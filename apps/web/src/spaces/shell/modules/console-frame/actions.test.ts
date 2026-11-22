import { beforeEach, describe, expect, it, vi } from "vitest";
import { chooseThemeAction, signOutAction } from "./actions";

const signOut = vi.fn<() => Promise<void>>();
const redirect = vi.fn<(href: string) => never>();
const setCookie =
  vi.fn<(name: string, value: string, options: object) => void>();

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ set: setCookie }),
}));

vi.mock("@/libs/data-access/identity", () => ({
  signOut: () => signOut(),
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => redirect(href),
}));

describe("signing out", () => {
  beforeEach(() => {
    signOut.mockReset();
    redirect.mockReset();
  });

  it("ends_the_session_and_opens_sign_in_saying_so", async () => {
    signOut.mockResolvedValue(undefined);

    await signOutAction();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/sign-in?reason=signed-out");
  });
});

describe("choosing a theme", () => {
  beforeEach(() => {
    setCookie.mockReset();
  });

  it.each([
    ["dark", "dark"],
    ["light", "light"],
    ["system", "system"],
    ["purple", "system"],
  ])("%s_is_kept_as_%s_for_a_year", async (chosen, kept) => {
    await chooseThemeAction(chosen);

    expect(setCookie).toHaveBeenCalledWith(
      "theme",
      kept,
      expect.objectContaining({ maxAge: 31_536_000, path: "/" }),
    );
  });
});
