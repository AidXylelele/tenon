import {
  InvalidDocumentValueError,
  NegativeAttemptCountError,
  UnsupportedConstructError,
} from '../../../../domain/errors.js';
import { UnsupportedConstruct } from '../../../../domain/automation/language/enums.js';
import type { JsonPointer } from '../../../../domain/automation/language/json-pointer.js';
import { ErrorCondition } from '../../../../domain/automation/language/error-condition.js';
import { RetryStrategy } from '../../../../domain/automation/language/retry-strategy.js';
import type * as Dsl from '../interfaces.js';
import { BackoffMapper } from './backoff.mapper.js';
import { ExpressionMapper } from './expression.mapper.js';
import { FixedDurationMapper } from './fixed-duration.mapper.js';

export class RetryStrategyMapper {
  static toDomain(node: Dsl.RetryPolicy, at: JsonPointer): RetryStrategy {
    const limitAt = at.at('limit');
    const attemptAt = limitAt.at('attempt');
    const jitterAt = at.at('jitter');
    const whenAt = at.at('when');
    const when = ExpressionMapper.toDomain(node.when, whenAt);
    const exceptWhenAt = at.at('exceptWhen');
    const exceptWhen = ExpressionMapper.toDomain(node.exceptWhen, exceptWhenAt);
    const condition = new ErrorCondition({ when, exceptWhen });
    const delayAt = at.at('delay');
    const delay = FixedDurationMapper.toDomain(node.delay, delayAt);
    const backoffAt = at.at('backoff');
    const backoff = BackoffMapper.toDomain(node.backoff, backoffAt);
    const attemptCount = node.limit?.attempt?.count ?? null;

    const attemptLimit = node.limit?.attempt?.duration;

    if (attemptLimit !== undefined) {
      const attemptDurationAt = attemptAt.at('duration');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.RetryAttemptDuration,
        attemptDurationAt,
      );
    }

    const totalLimit = node.limit?.duration;
    const totalDurationAt = limitAt.at('duration');
    const totalDuration = FixedDurationMapper.toDomain(
      totalLimit,
      totalDurationAt,
    );
    const jitterFromAt = jitterAt.at('from');
    const jitterFrom = FixedDurationMapper.toDomain(
      node.jitter?.from,
      jitterFromAt,
    );
    const jitterToAt = jitterAt.at('to');
    const jitterTo = FixedDurationMapper.toDomain(node.jitter?.to, jitterToAt);

    try {
      return new RetryStrategy({
        condition,
        delay,
        backoff,
        attemptCount,
        totalDuration,
        jitterFrom,
        jitterTo,
      });
    } catch (error) {
      if (!(error instanceof NegativeAttemptCountError)) throw error;

      const countAt = attemptAt.at('count');
      throw new InvalidDocumentValueError(countAt, error);
    }
  }
}
