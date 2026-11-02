import { Injectable } from '@nestjs/common';
import { NonRetryableMessageError } from '@nestjs/outbox';
import { ErrorClass } from '../resilience/enums.js';
import { ErrorClassifier } from '../resilience/error-classifier.js';

@Injectable()
export class OutboxErrors {
  private static readonly NOT_HANDLED = 'The message could not be handled';

  constructor(private readonly classifier: ErrorClassifier) {}

  async handled(work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      const kind = this.classifier.classify(error);

      if (kind === ErrorClass.Settled) return;

      if (kind === ErrorClass.Transient) throw error;

      throw new NonRetryableMessageError(OutboxErrors.NOT_HANDLED, {
        cause: error,
      });
    }
  }
}
