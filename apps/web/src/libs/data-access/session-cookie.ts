export const SESSION_COOKIE = "console_session";
export const SECURE_SESSION_COOKIE = "__Host-console_session";

export const SIGN_IN_AGAIN_HEADER = "x-console-sign-in-again";

export function sessionCookieName(secure: boolean): string {
  return secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE;
}

interface IssuedSession {
  readonly pair: string;
  readonly maxAge: number;
}

export function issuedSession(
  setCookies: readonly string[],
): IssuedSession | null {
  for (const header of setCookies) {
    const [pair = "", ...attributes] = header
      .split(";")
      .map((part) => part.trim());
    const maxAgeAttribute = attributes.find((attribute) =>
      attribute.toLowerCase().startsWith("max-age="),
    );
    const isSession = pair.includes("=") && maxAgeAttribute !== undefined;

    if (!isSession) continue;

    const secondsText = maxAgeAttribute.slice("max-age=".length);
    const seconds = Number(secondsText);
    const finite = Number.isFinite(seconds);
    const maxAge = finite ? seconds : 0;
    return { pair, maxAge };
  }

  return null;
}
