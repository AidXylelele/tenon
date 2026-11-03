import { Injectable } from '@nestjs/common';
import { StaleWriteError } from '../../domain/errors.js';
import { PostgresTransientFailures } from '../drizzle/postgres-transient-failures.js';
import { CapacityExhaustedError } from '../runtime/execution/faults.js';
import { ErrorClass } from './enums.js';

// A failure that repeating the work may cure (a lost race, an outage of the database or a
// socket) or one it never will.
@Injectable()
export class ErrorClassifier {
  private static readonly SOCKET_ERRORS: readonly string[] = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
    'EAI_AGAIN',
  ];

  constructor(private readonly transientFailures: PostgresTransientFailures) {}

  classify(error: unknown): ErrorClass {
    const transient =
      error instanceof StaleWriteError ||
      error instanceof CapacityExhaustedError ||
      this.transientFailures.includes(error) ||
      this.#socketError(error);

    if (transient) return ErrorClass.Transient;

    return ErrorClass.Permanent;
  }

  #socketError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const code: unknown = Reflect.get(error, 'code');
    return (
      typeof code === 'string' && ErrorClassifier.SOCKET_ERRORS.includes(code)
    );
  }
}
