import { WorkDeferredError } from '../../../src/application/errors.js';
import {
  InstanceNotFoundError,
  StaleWriteError,
  VersionNotFoundError,
} from '../../../src/domain/errors.js';
import { PostgresTransientFailures } from '../../../src/frameworks/drizzle/postgres-transient-failures.js';
import { ErrorClass } from '../../../src/frameworks/resilience/enums.js';
import { ErrorClassifier } from '../../../src/frameworks/resilience/error-classifier.js';

function failure(message: string, code: string, cause?: unknown): Error {
  const error = new Error(message, { cause });
  Reflect.set(error, 'code', code);
  return error;
}

describe('ErrorClassifier', () => {
  const classifier = new ErrorClassifier(new PostgresTransientFailures());

  it('a_missing_instance_is_settled', () => {
    const kind = classifier.classify(new InstanceNotFoundError());

    expect(kind).toBe(ErrorClass.Settled);
  });

  it.each([
    ['a_stale_write', new StaleWriteError()],
    ['deferred_work', new WorkDeferredError()],
    ['a_reset_socket', failure('read ECONNRESET', 'ECONNRESET')],
    ['a_serialization_failure', failure('could not serialize', '40001')],
    [
      'an_admin_shutdown_found_through_its_cause',
      new Error('query failed', { cause: failure('terminating', '57P01') }),
    ],
    ['a_pool_timeout', new Error('timeout exceeded when trying to connect')],
  ])('%s_is_transient', (_name, error) => {
    const kind = classifier.classify(error);

    expect(kind).toBe(ErrorClass.Transient);
  });

  it.each([
    ['a_unique_violation', failure('duplicate key', '23505')],
    ['a_type_error', new TypeError('wrong')],
    ['a_value_that_is_not_an_error', 'boom'],
    ['a_missing_version', new VersionNotFoundError()],
    ['a_protocol_violation', failure('too many parameters', '08P01')],
  ])('%s_is_permanent', (_name, error) => {
    const kind = classifier.classify(error);

    expect(kind).toBe(ErrorClass.Permanent);
  });
});
