export class FieldPath {
  readonly #segments: readonly string[];

  constructor(path: string) {
    this.#segments = path === '' ? [] : path.split('.');
  }

  read(value: unknown): unknown {
    let current = value;

    for (const segment of this.#segments) {
      if (current === null || typeof current !== 'object') return undefined;

      const own = Object.hasOwn(current, segment);

      if (!own) return undefined;

      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  }
}
