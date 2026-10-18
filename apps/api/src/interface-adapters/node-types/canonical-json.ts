export class CanonicalJson {
  static of(value: unknown): string {
    return JSON.stringify(value, (_key, nested: unknown) =>
      CanonicalJson.sorted(nested),
    );
  }

  private static sorted(value: unknown): unknown {
    const isArray = Array.isArray(value);

    if (value === null || typeof value !== 'object' || isArray) {
      return value;
    }

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const entries = keys.map((key): [string, unknown] => [key, record[key]]);
    return Object.fromEntries(entries);
  }
}
