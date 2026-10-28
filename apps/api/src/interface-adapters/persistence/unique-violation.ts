import { DrizzleQueryError } from 'drizzle-orm/errors';

const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof DrizzleQueryError)) return false;

  const cause = error.cause as { code?: string } | undefined;
  return cause?.code === UNIQUE_VIOLATION;
}
