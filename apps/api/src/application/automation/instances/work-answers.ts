import { Injectable } from '@nestjs/common';
import type {
  ProcessRun,
  ServiceCall,
} from '../../../domain/automation/language/interfaces.js';
import { RoundResults } from '../../../domain/automation/language/round-results.js';
import { RoundWork } from '../../../domain/automation/language/round-work.js';
import { ExpressionEvaluator, SchemaValidator } from '../language/ports.js';
import { ProcessRunner, ServiceCaller, type WorkAnswer } from './ports.js';

interface Arrival {
  readonly index: number;
  readonly answer: WorkAnswer;
}

// A pass's answers in the order they arrive: the expressions and schemas together, then each
// call and process as it ends. The instance records each one at the time it came, so the first
// competing branch to finish wins and a deadline is judged against the answer's own time.
@Injectable()
export class WorkAnswers {
  constructor(
    private readonly expressions: ExpressionEvaluator,
    private readonly schemas: SchemaValidator,
    private readonly services: ServiceCaller,
    private readonly processes: ProcessRunner,
  ) {}

  async *inArrivalOrder(work: RoundWork): AsyncGenerator<WorkAnswer> {
    const coming = new Map<number, Promise<Arrival>>();
    const answers = this.#answersTo(work);

    for (const [index, answer] of answers.entries())
      coming.set(
        index,
        answer.then((arrived) => ({ index, answer: arrived })),
      );

    while (coming.size > 0) {
      const arrival = await Promise.race(coming.values());
      coming.delete(arrival.index);
      yield arrival.answer;
    }
  }

  #answersTo(work: RoundWork): Promise<WorkAnswer>[] {
    const answers: Promise<WorkAnswer>[] = [];
    if (work.computes()) answers.push(this.#computed(work));

    for (const call of work.calls) answers.push(this.#called(call));

    for (const run of work.processes) answers.push(this.#ran(run));

    return answers;
  }

  async #computed(work: RoundWork): Promise<WorkAnswer> {
    const computations = [
      this.expressions.evaluateAll(work.evaluations),
      this.schemas.validateAll(work.validations),
    ] as const;
    const [evaluated, validated] = await Promise.all(computations);
    const results = RoundResults.computed(evaluated, validated);
    return { results, deferred: 0 };
  }

  async #called(call: ServiceCall): Promise<WorkAnswer> {
    const response = await this.services.call(call);
    const results = RoundResults.responded(response);
    const asked = RoundWork.calling(call);
    const deferred = results.deferredIn(asked);
    return { results, deferred };
  }

  async #ran(run: ProcessRun): Promise<WorkAnswer> {
    const process = await this.processes.run(run);
    const results = RoundResults.exited(process);
    const asked = RoundWork.running(run);
    const deferred = results.deferredIn(asked);
    return { results, deferred };
  }
}
