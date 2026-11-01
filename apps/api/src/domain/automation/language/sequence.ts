import { InconsistentProgressError } from '../../errors.js';
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

  constructor(props: SequenceProps) {
    const counted = Number.isInteger(props.position) && props.position >= 0;

    if (!counted)
      throw new InconsistentProgressError(
        'a sequence runs the task at a position counted from zero',
      );

    this.#position = props.position;
    this.#variables = props.variables;
  }

  static start(
    list: TaskList,
    input: JsonValue,
    variables: JsonObject,
  ): Step<Sequence | Outcome> {
    const first = list.tasks[0];

    if (first === undefined) {
      const completed = Outcome.of(input);
      return Step.of<Sequence | Outcome>(completed);
    }

    const sequence = new Sequence({ position: 0, variables });
    const start: TaskStart = { reference: first.reference, input, variables };
    return new Step<Sequence | Outcome>(sequence, [start]);
  }

  get position(): number {
    return this.#position;
  }

  get variables(): JsonObject {
    return this.#variables;
  }

  childEnded(
    child: JsonPointer,
    ending: TaskEnding,
    list: TaskList,
  ): Step<Sequence | Outcome> {
    const current = list.tasks[this.#position];
    const awaited = current?.reference.equals(child) ?? false;

    if (!awaited) return Step.of<Sequence | Outcome>(this);

    const failure = ending.failure;

    if (failure !== null) {
      const failed = Outcome.failed(failure);
      return Step.of<Sequence | Outcome>(failed);
    }

    return this.#continued(ending, list);
  }

  #continued(ending: TaskEnding, list: TaskList): Step<Sequence | Outcome> {
    const workflowEnd = ending.workflowEnd();

    if (workflowEnd !== null) return Step.of<Sequence | Outcome>(workflowEnd);

    const output = ending.output;
    const directive = ending.directive;
    const next = directive?.nextAfter(this.#position, list) ?? null;
    const completed = Outcome.of(output);

    if (next === null) return Step.of<Sequence | Outcome>(completed);

    const task = list.tasks[next];

    if (task === undefined) return Step.of<Sequence | Outcome>(completed);

    const sequence = new Sequence({
      position: next,
      variables: this.#variables,
    });
    const start: TaskStart = {
      reference: task.reference,
      input: output,
      variables: this.#variables,
    };
    return new Step<Sequence | Outcome>(sequence, [start]);
  }
}
