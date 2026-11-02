// PostgreSQL binds at most 65,535 parameters per statement, so rows go in batches.
export class Batches {
  static readonly #SIZE = 1_000;

  static *of<T>(rows: readonly T[]): Generator<T[]> {
    for (let start = 0; start < rows.length; start += Batches.#SIZE) {
      const end = start + Batches.#SIZE;
      yield rows.slice(start, end);
    }
  }
}
