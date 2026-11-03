// The console's own cookie that holds the API's session as `name=token` (research R3). Under
// HTTPS it carries the `__Host-` prefix, which pins it to this origin and path.

export const SESSION_COOKIE = 'console_session';
export const SECURE_SESSION_COOKIE = '__Host-console_session';

// The request header through which `proxy.ts` tells the app where a person whose session ended
// signs in again, so they return to the page being rendered afterwards.
export const SIGN_IN_AGAIN_HEADER = 'x-console-sign-in-again';

export function sessionCookieName(secure: boolean): string {
  return secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE;
}

export interface IssuedSession {
  readonly pair: string;
  readonly maxAge: number;
}

// The session pair and lifetime the API set, from its `Set-Cookie` headers; null when it set
// none. A `Max-Age` of 0 means the API ended the session.
export function issuedSession(
  setCookies: readonly string[],
): IssuedSession | null {
  for (const header of setCookies) {
    const [pair = '', ...attributes] = header
      .split(';')
      .map((part) => part.trim());
    const maxAge = attributes.find((attribute) =>
      attribute.toLowerCase().startsWith('max-age='),
    );

    if (!pair.includes('=') || maxAge === undefined) continue;

    const seconds = Number(maxAge.slice('max-age='.length));
    return { pair, maxAge: Number.isFinite(seconds) ? seconds : 0 };
  }

  return null;
}
