import { Injectable } from '@nestjs/common';
import { NonRetryableStepError } from '@nestjs/workflows';
import { ErrorClass } from '../resilience/enums.js';
import { ErrorClassifier } from '../resilience/error-classifier.js';

@Injectable()
export class StepErrors {
  private static readonly NOT_ADVANCED = 'The instance could not advance';

  constructor(private readonly classifier: ErrorClassifier) {}

  async classified<T>(work: () => Promise<T>): Promise<T | null> {
    try {
      return await work();
    } catch (error) {
      const kind = this.classifier.classify(error);

      if (kind === ErrorClass.Settled) return null;

      if (kind === ErrorClass.Transient) throw error;

      throw new NonRetryableStepError(StepErrors.NOT_ADVANCED, {
        cause: error,
      });
    }
  }
}
