import { BulkheadFullError } from '@nestjs/resilience';
import pg from 'pg';
import { NotFoundError, StaleWriteError } from '../domain/errors.js';

const TRANSIENT_SQLSTATE_CLASSES = new Set(['08', '40', '53', '57']);

const TRANSIENT_SYSTEM_CODES = new Set([
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'ETIMEDOUT',
]);

export class ErrorClassifier {
  isTransient(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    if (error instanceof StaleWriteError) return true;

    if (error instanceof BulkheadFullError) return true;

    if (error instanceof pg.DatabaseError) {
      const sqlstateClass = error.code?.slice(0, 2) ?? '';
      return TRANSIENT_SQLSTATE_CLASSES.has(sqlstateClass);
    }

    const code = (error as NodeJS.ErrnoException).code ?? '';

    if (TRANSIENT_SYSTEM_CODES.has(code)) return true;

    return this.isTransient(error.cause);
  }

  isSettled(error: unknown): boolean {
    return error instanceof NotFoundError;
  }
}
