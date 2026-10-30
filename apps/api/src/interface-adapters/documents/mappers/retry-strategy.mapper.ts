import {
  InvalidDocumentValueError,
  NegativeAttemptCountError,
} from '../../../domain/errors.js';
import type { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import { RetryStrategy } from '../../../domain/automation/language/retry-strategy.js';
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
    const delayAt = at.at('delay');
    const delay = FixedDurationMapper.toDomain(node.delay, delayAt);
    const backoff = BackoffMapper.toDomain(node.backoff);
    const attemptCount = node.limit?.attempt?.count ?? null;
    const attemptLimit = node.limit?.attempt?.duration;
    const attemptDurationAt = attemptAt.at('duration');
    const attemptDuration = FixedDurationMapper.toDomain(
      attemptLimit,
      attemptDurationAt,
    );
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
        when,
        exceptWhen,
        delay,
        backoff,
        attemptCount,
        attemptDuration,
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
