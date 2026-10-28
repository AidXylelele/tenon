import { BulkheadFullError } from '@nestjs/resilience';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import pg from 'pg';
import {
  StaleWriteError,
  UserNotFoundError,
} from '../../../src/domain/errors.js';
import { ErrorClassifier } from '../../../src/interface-adapters/error-classifier.js';

function databaseError(code: string): pg.DatabaseError {
  const error = new pg.DatabaseError('database refused', 0, 'error');
  error.code = code;
  return error;
}

function systemError(code: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error('socket failed');
  error.code = code;
  return error;
}

describe('ErrorClassifier', () => {
  const classifier = new ErrorClassifier();

  it.each([
    ['a_stale_write', new StaleWriteError()],
    ['a_full_bulkhead', new BulkheadFullError('processes', 'full')],
    ['a_serialization_failure', databaseError('40001')],
    ['a_deadlock', databaseError('40P01')],
    ['a_lost_connection', databaseError('08006')],
    ['too_many_connections', databaseError('53300')],
    ['a_reset_socket', systemError('ECONNRESET')],
    [
      'a_query_failure_caused_by_a_deadlock',
      new DrizzleQueryError('select 1', [], databaseError('40P01')),
    ],
  ])('%s_is_transient', (_, error) => {
    expect(classifier.isTransient(error)).toBe(true);
  });

  it.each([
    ['a_unique_violation', databaseError('23505')],
    ['a_programming_error', new TypeError('undefined is not a function')],
    ['a_missing_record', new UserNotFoundError()],
    ['a_thrown_string', 'failure'],
  ])('%s_is_not_transient', (_, error) => {
    expect(classifier.isTransient(error)).toBe(false);
  });

  it('a_missing_record_is_settled_and_a_stale_write_is_not', () => {
    expect(classifier.isSettled(new UserNotFoundError())).toBe(true);
    expect(classifier.isSettled(new StaleWriteError())).toBe(false);
  });
});
