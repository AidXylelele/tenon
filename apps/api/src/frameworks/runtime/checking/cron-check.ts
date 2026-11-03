import type { Specification } from '@openworkflowspec/sdk';
import type { CheckProblem } from '../../../interface-adapters/workflows/interfaces.js';
import type { CronClient, DefinitionCheck } from '../interfaces.js';

// A schedule's cron is one the engine runs, checked at publish rather than when the workflow
// is turned on.
export class CronCheck implements DefinitionCheck {
  static readonly #POINTER = '/schedule/cron';

  constructor(private readonly crons: CronClient) {}

  async firstProblem(
    workflow: Specification.Workflow,
  ): Promise<CheckProblem | null> {
    const cron = workflow.schedule?.cron;

    if (cron === undefined) return null;

    const detail = await this.crons.problemOf(cron);

    if (detail === null) return null;

    return { pointer: CronCheck.#POINTER, detail };
  }
}
