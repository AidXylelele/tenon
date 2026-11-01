import type { WorkflowError } from '../workflow-error.js';
import { EvaluationResult } from './evaluation-result.js';

export class Evaluated extends EvaluationResult {
  failure(): WorkflowError | null {
    return null;
  }
}
