import { type NextRequest, NextResponse } from 'next/server';
import {
  REQUEST_URL_HEADER,
  SECURE_SESSION_COOKIE,
  SESSION_COOKIE,
} from '@/libs/data-access/session-cookie';

// Pages a visitor reaches without a session.
const ANONYMOUS = [
  '/sign-in',
  '/forgot-password',
  '/reset-password',
  '/invitations/accept',
];

// Runs before every page: a nonce-based Content Security Policy (docs, Content Security
// Policy), the URL being rendered for the app, and the optimistic session check that sends a
// visitor without a session to sign in (docs, Authentication). The API decides the rest.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const here = `${pathname}${search}`;

  if (!isAnonymous(pathname) && !hasSession(request)) {
    const signIn = new URL('/sign-in', request.url);
    signIn.searchParams.set('next', here);
    return NextResponse.redirect(signIn);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = policyOf(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);
  requestHeaders.set(REQUEST_URL_HEADER, here);

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
