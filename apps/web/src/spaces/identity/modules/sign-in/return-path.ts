import { HOME_HREF } from '@/operations/app-routes';

// A path inside the console to return to after signing in. It is resolved the way a browser
// resolves it, so a value that leaves the console (another origin, `//host`, `/\\host`, a tab or
// a newline that browsers strip) returns to the start page instead.
export function returnPath(next: string | undefined): string {
  const start = HOME_HREF;

  if (next === undefined || !next.startsWith('/')) return start;

  const base = 'http://console.invalid';
  let url: URL;

  try {
    url = new URL(next, base);
  } catch {
    return start;
  }

  if (url.origin !== base) return start;

  return `${url.pathname}${url.search}${url.hash}`;
}
