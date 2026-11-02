import { DrizzleQueryError } from 'drizzle-orm/errors';

// A write that a concurrent write of the same row beat to the unique index.
export class UniqueViolation {
  static readonly #CODE = '23505';

  static is(error: unknown): boolean {
    if (!(error instanceof DrizzleQueryError)) return false;

    const cause = error.cause as { code?: string } | undefined;
    return cause?.code === UniqueViolation.#CODE;
  }

  // The write's result, or the error `raced` names when a concurrent write won.
  static async translated<T>(
    write: PromiseLike<T>,
    raced: () => Error,
  ): Promise<T> {
    try {
      return await write;
    } catch (error) {
      if (UniqueViolation.is(error)) throw raced();

      throw error;
    }
  }
}
