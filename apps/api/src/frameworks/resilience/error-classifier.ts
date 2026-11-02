import { Injectable } from '@nestjs/common';
import { WorkDeferredError } from '../../application/errors.js';
import {
  InstanceNotFoundError,
  StaleRoundError,
  StaleWriteError,
} from '../../domain/errors.js';
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

  // A run or message whose instance is gone has nothing left to do; any other record missing
  // from a run is corrupt state, which faults the instance or dead-letters the message.
  classify(error: unknown): ErrorClass {
    // A stale round belongs to a worker that lost the instance: its successor goes on.
    const settled =
      error instanceof InstanceNotFoundError ||
      error instanceof StaleRoundError;

    if (settled) return ErrorClass.Settled;

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
