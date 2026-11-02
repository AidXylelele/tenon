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
  private static readonly POOL_FAILURES = [
    'timeout exceeded when trying to connect',
    'Connection terminated',
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
        PostgresTransientFailures.TRANSIENT_CLASSES.includes(code.slice(0, 2));
      const pool = PostgresTransientFailures.POOL_FAILURES.some((failure) =>
        current instanceof Error ? current.message.includes(failure) : false,
      );

      if (transientClass || pool) return true;
    }

    return false;
  }
}
