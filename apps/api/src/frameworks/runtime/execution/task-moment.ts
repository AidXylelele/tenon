import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import type { JsonPointer } from '../document/json-pointer.js';
import { DateTimes } from './date-times.js';
import type { TaskItem } from './endings.js';

interface TaskMomentProps {
  readonly name: string;
  readonly definition: Specification.Task;
  readonly startedAt: number;
  readonly rawInput: JsonValue;
  readonly input: JsonValue | undefined;
  readonly rawOutput: JsonValue | undefined;
  readonly output: JsonValue | undefined;
  readonly authorization: JsonObject | null;
}

// A task's data where one of its expressions is evaluated (DSL 1.0.3, "Runtime expression
// arguments"): `$task` keeps the raw input, the raw output and the start, `$input` and `$output`
// the transformed ones, `$authorization` the one the task resolved; what is not known yet is
// not bound.
export class TaskMoment {
  readonly #props: TaskMomentProps;

  private constructor(props: TaskMomentProps) {
    this.#props = props;
  }

  static started(
    item: TaskItem,
    startedAt: number,
    rawInput: JsonValue,
  ): TaskMoment {
    return new TaskMoment({
      name: item.name,
      definition: item.task,
      startedAt,
      rawInput,
      input: undefined,
      rawOutput: undefined,
      output: undefined,
      authorization: null,
    });
  }

  // The input `input.from` gave.
  given(input: JsonValue): TaskMoment {
    return this.#moved({ input });
  }

  // The output the task's work gave, before `output.as`.
  produced(rawOutput: JsonValue, authorization: JsonObject | null): TaskMoment {
    return this.#moved({ rawOutput, authorization });
  }

  // The output `output.as` gave.
  transformed(output: JsonValue): TaskMoment {
    return this.#moved({ output });
  }

  // `$input`: the transformed input, or the raw one before `input.from`.
  get input(): JsonValue {
    const input = this.#props.input;
    return input === undefined ? this.#props.rawInput : input;
  }

  get output(): JsonValue | undefined {
    return this.#props.output;
  }

  get authorization(): JsonObject | null {
    return this.#props.authorization;
  }

  // `$task` (DSL 1.0.3, "Task Descriptor").
  descriptorAt(reference: JsonPointer): JsonObject {
    const props = this.#props;
    const startedAt = DateTimes.descriptorOf(props.startedAt);
    return {
      name: props.name,
      reference: reference.toString(),
      definition: props.definition as unknown as JsonObject,
      input: props.rawInput,
      output: props.rawOutput ?? null,
      startedAt,
    };
  }

  #moved(changes: Partial<TaskMomentProps>): TaskMoment {
    const props: TaskMomentProps = Object.assign({}, this.#props, changes);
    return new TaskMoment(props);
  }
}
