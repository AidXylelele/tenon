import type {
  JsonObject,
  JsonValue,
  SequenceProps,
  TaskStart,
} from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';
import type { TaskList } from './task-list.js';
import { Outcome } from './outcome.js';
import { Step } from './step.js';
import type { TaskEnding } from './task-ending.js';

export class Sequence {
  readonly #position: number;
  readonly #variables: JsonObject;
  readonly #outcome: Outcome | null;

  constructor(props: SequenceProps) {
    this.#position = props.position;
    this.#variables = props.variables;
    this.#outcome = props.outcome;
  }

  static start(
    list: TaskList,
    input: JsonValue,
    variables: JsonObject,
  ): Step<Sequence> {
    const first = list.tasks[0];

    if (first === undefined) {
      const outcome = Outcome.of(input);
      const done = new Sequence({ position: 0, variables, outcome });
      return Step.of(done);
    }

    const sequence = new Sequence({ position: 0, variables, outcome: null });
    const start: TaskStart = { reference: first.reference, input, variables };
    return new Step(sequence, [start]);
  }

  get position(): number {
    return this.#position;
  }

  get variables(): JsonObject {
    return this.#variables;
  }

  get outcome(): Outcome | null {
    return this.#outcome;
  }

  childEnded(
    child: JsonPointer,
    ending: TaskEnding,
    list: TaskList,
  ): Step<Sequence> {
    const current = list.tasks[this.#position];
    const awaited = current?.reference.equals(child) ?? false;

    if (this.#outcome !== null || !awaited) return Step.of(this);

    const failure = ending.failure;

    if (failure !== null) {
      const failed = Outcome.failed(failure);
      return this.#ended(failed);
    }

    return this.#continued(ending, list);
  }

  #continued(ending: TaskEnding, list: TaskList): Step<Sequence> {
    const workflowEnd = ending.workflowEnd();

    if (workflowEnd !== null) return this.#ended(workflowEnd);

    const output = ending.output;
    const directive = ending.directive;
    const next = directive?.nextAfter(this.#position, list) ?? null;
    const completed = Outcome.of(output);

    if (next === null) return this.#ended(completed);

    const task = list.tasks[next];

    if (task === undefined) return this.#ended(completed);

    const sequence = new Sequence({
      position: next,
      variables: this.#variables,
      outcome: null,
    });
    const start: TaskStart = {
      reference: task.reference,
      input: output,
      variables: this.#variables,
    };
    return new Step(sequence, [start]);
  }

  #ended(outcome: Outcome): Step<Sequence> {
    const ended = new Sequence({
      position: this.#position,
      variables: this.#variables,
      outcome,
    });
    return Step.of(ended);
  }
}
