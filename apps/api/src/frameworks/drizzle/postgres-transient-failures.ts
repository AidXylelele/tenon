import { Injectable } from '@nestjs/common';

@Injectable()
export class PostgresTransientFailures {
  private static readonly TRANSIENT_CLASSES: readonly string[] = [
    '08',
    '40',
    '53',
    '57',
  ];
  private static readonly SQLSTATE = /^[0-9A-Z]{5}$/;
  // A protocol violation (too many parameters, say) repeats on every attempt.
  private static readonly LASTING = ['08P01'];
  private static readonly POOL_FAILURES = [
    'timeout exceeded when trying to connect',
    'Connection terminated',
  ];
  // The server could not be reached, which Drizzle reports as the cause of its query error. A
  // stopped database container is not found by its name (`postgres` in Compose).
  private static readonly CONNECTION_FAILURES: readonly string[] = [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EAI_AGAIN',
    'ENOTFOUND',
  ];

  includes(error: unknown): boolean {
    for (
      let current: unknown = error;
      current instanceof Error;
      current = current.cause
    ) {
      const code: unknown = Reflect.get(current, 'code');
      const sqlState =
        typeof code === 'string' &&
        PostgresTransientFailures.SQLSTATE.test(code);
      const transientClass =
        sqlState &&
        PostgresTransientFailures.TRANSIENT_CLASSES.includes(
          code.slice(0, 2),
        ) &&
        !PostgresTransientFailures.LASTING.includes(code);
      const pool = PostgresTransientFailures.POOL_FAILURES.some((failure) =>
        current instanceof Error ? current.message.includes(failure) : false,
      );
      const unreachable =
        typeof code === 'string' &&
        PostgresTransientFailures.CONNECTION_FAILURES.includes(code);

      if (transientClass || pool || unreachable) return true;
    }

    return false;
  }
}
