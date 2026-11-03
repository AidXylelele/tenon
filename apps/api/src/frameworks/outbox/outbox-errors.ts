import { Injectable, Logger } from '@nestjs/common';
import { NonRetryableMessageError } from '@nestjs/outbox';
import { ErrorClass } from '../resilience/enums.js';
import { ErrorClassifier } from '../resilience/error-classifier.js';

@Injectable()
export class OutboxErrors {
  private static readonly NOT_HANDLED = 'The message could not be handled';
  private static readonly NOT_YET = 'The message could not be handled yet';
  private static readonly LOGGER = new Logger(OutboxErrors.name);

  constructor(private readonly classifier: ErrorClassifier) {}

  async handled(work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      const kind = this.classifier.classify(error);

      // The outbox stores what it retries: a short text, not a query with its values.
      if (kind === ErrorClass.Transient) {
        OutboxErrors.LOGGER.warn(error);
        throw new Error(OutboxErrors.NOT_YET);
      }

      // The dead letter keeps only the wrapper's message, so the cause is logged here.
      OutboxErrors.LOGGER.error(error);
      throw new NonRetryableMessageError(OutboxErrors.NOT_HANDLED, {
        cause: error,
      });
    }
  }
}
