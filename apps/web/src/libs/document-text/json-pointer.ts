// RFC 6901 JSON Pointers: the tokens of a pointer and the pointer of tokens.

export function tokensOf(pointer: string): string[] {
  if (pointer === '') return [];

  return pointer
    .split('/')
    .slice(1)
    .map((token) => token.replaceAll('~1', '/').replaceAll('~0', '~'));
}

export function pointerOf(tokens: readonly (string | number)[]): string {
  return tokens
    .map(
      (token) =>
        `/${String(token).replaceAll('~', '~0').replaceAll('/', '~1')}`,
    )
    .join('');
}

// Whether `pointer` is `prefix` or lies inside it.
export function isWithin(pointer: string, prefix: string): boolean {
  return pointer === prefix || pointer.startsWith(`${prefix}/`);
}
