import { type NextRequest, NextResponse } from 'next/server';
import {
  SECURE_SESSION_COOKIE,
  SESSION_COOKIE,
  SIGN_IN_AGAIN_HEADER,
} from '@/libs/data-access/session-cookie';
import {
  ACCEPT_INVITATION_HREF,
  FORGOT_PASSWORD_HREF,
  RESET_PASSWORD_HREF,
  SIGN_IN_HREF,
  signInHref,
} from '@/operations/app-routes';

// Pages a visitor reaches without a session.
const ANONYMOUS = [
  SIGN_IN_HREF,
  FORGOT_PASSWORD_HREF,
  RESET_PASSWORD_HREF,
  ACCEPT_INVITATION_HREF,
];

// Runs before every page: a nonce-based Content Security Policy (docs, Content Security
// Policy), where the app sends a person whose session ends while the page renders, and the
// optimistic session check that sends a visitor without a session to sign in (docs,
// Authentication). The API decides the rest.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const here = `${pathname}${search}`;

  if (!isAnonymous(pathname) && !hasSession(request)) {
    const signIn = signInHref({ next: here });
    const address = new URL(signIn, request.url);
    return NextResponse.redirect(address);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = policyOf(nonce);
  const signInAgain = signInHref({ reason: 'ended', next: here });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);
  requestHeaders.set(SIGN_IN_AGAIN_HEADER, signInAgain);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

function isAnonymous(pathname: string): boolean {
  return ANONYMOUS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function hasSession(request: NextRequest): boolean {
  return (
    request.cookies.has(SESSION_COOKIE) ||
    request.cookies.has(SECURE_SESSION_COOKIE)
  );
}

// Scripts run only with the nonce. Styles allow inline: React writes `style` attributes on the
// server and Radix, sonner and CodeMirror set styles at run time (research R6).
function policyOf(nonce: string): string {
  const development = process.env.NODE_ENV === 'development';
  const secure = process.env.SESSION_COOKIE_SECURE !== 'false';
  const evaluation = development ? " 'unsafe-eval'" : '';
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evaluation}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    // The canvas lays out in a worker of its own bundle (research R16).
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (secure) directives.push('upgrade-insecure-requests');

  return directives.join('; ');
}
