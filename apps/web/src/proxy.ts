import { type NextRequest, NextResponse } from "next/server";
import {
  isDevelopment,
  isSessionCookieSecure,
} from "@/libs/data-access/environment";
import {
  SECURE_SESSION_COOKIE,
  SESSION_COOKIE,
  SIGN_IN_AGAIN_HEADER,
} from "@/libs/data-access/session-cookie";
import {
  ACCEPT_INVITATION_HREF,
  FORGOT_PASSWORD_HREF,
  RESET_PASSWORD_HREF,
  SIGN_IN_HREF,
  signInHref,
} from "@/libs/routing/routes";

const ANONYMOUS = [
  SIGN_IN_HREF,
  FORGOT_PASSWORD_HREF,
  RESET_PASSWORD_HREF,
  ACCEPT_INVITATION_HREF,
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const here = `${pathname}${search}`;
  const needsSignIn = !isAnonymous(pathname) && !hasSession(request);

  if (needsSignIn) {
    const signIn = signInHref({ next: here });
    const address = new URL(signIn, request.url);
    return NextResponse.redirect(address);
  }

  const uuid = crypto.randomUUID();
  const nonce = Buffer.from(uuid).toString("base64");
  const policy = policyOf(nonce);
  const signInAgain = signInHref({ reason: "ended", next: here });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  requestHeaders.set(SIGN_IN_AGAIN_HEADER, signInAgain);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

function isAnonymous(pathname: string): boolean {
  return ANONYMOUS.some((path) => {
    const prefix = `${path}/`;
    return pathname === path || pathname.startsWith(prefix);
  });
}

function hasSession(request: NextRequest): boolean {
  return (
    request.cookies.has(SESSION_COOKIE) ||
    request.cookies.has(SECURE_SESSION_COOKIE)
  );
}

function policyOf(nonce: string): string {
  const development = isDevelopment();
  const secure = isSessionCookieSecure();
  const evaluation = development ? " 'unsafe-eval'" : "";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evaluation}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (secure) directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}
