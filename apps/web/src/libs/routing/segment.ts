import { notFound } from 'next/navigation';

// A dynamic route segment as text; a malformed escape (`%zz`) is a page that does not exist,
// not a failure of the console.
export function segment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    notFound();
  }
}

export type Query = Record<string, string | string[] | undefined>;

// A search parameter given once, or undefined when it is absent, empty or repeated.
export function single(query: Query, key: string): string | undefined {
  const value = query[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}
