import { Injectable } from '@nestjs/common';
import { WorkDeferredError } from '../../application/errors.js';
import { NotFoundError, StaleWriteError } from '../../domain/errors.js';
import { PostgresTransientFailures } from '../drizzle/postgres-transient-failures.js';
import { ErrorClass } from './enums.js';

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
    if (error instanceof NotFoundError) return ErrorClass.Settled;

    const transient =
      error instanceof StaleWriteError ||
      error instanceof WorkDeferredError ||
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
