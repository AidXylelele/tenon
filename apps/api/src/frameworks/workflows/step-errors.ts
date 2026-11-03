import { Injectable, Logger } from '@nestjs/common';
import { NonRetryableStepError } from '@nestjs/workflows';
import { ErrorClass } from '../resilience/enums.js';
import { ErrorClassifier } from '../resilience/error-classifier.js';

@Injectable()
export class StepErrors {
  private static readonly NOT_ADVANCED = 'The instance could not advance';
  private static readonly NOT_YET = 'The instance could not advance yet';
  private static readonly LOGGER = new Logger(StepErrors.name);

  constructor(private readonly classifier: ErrorClassifier) {}

  async classified<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const kind = this.classifier.classify(error);

      // The engine journals what it retries: a short text, not a query with its values.
      if (kind === ErrorClass.Transient) {
        StepErrors.LOGGER.warn(error);
        throw new Error(StepErrors.NOT_YET);
      }

      // The engine keeps only the wrapper's message, so the cause is logged here.
      StepErrors.LOGGER.error(error);
      throw new NonRetryableStepError(StepErrors.NOT_ADVANCED, {
        cause: error,
      });
    }
  }
}
