import { UnknownTaskError } from '../../errors.js';
import { FlowKeyword } from './enums.js';
import type { FlowDirectiveProps } from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';

export class FlowDirective {
  readonly #value: string;
  readonly #pointer: JsonPointer;

  constructor(props: FlowDirectiveProps) {
    this.#value = props.value ?? FlowKeyword.Continue;
    this.#pointer = props.pointer;
  }

  get value(): string {
    return this.#value;
  }

  namesTask(): boolean {
    const keywords: readonly string[] = Object.values(FlowKeyword);
    const keyword = keywords.includes(this.#value);
    return !keyword;
  }

  confirmWithin(tasks: ReadonlySet<string>): void {
    const namesTask = this.namesTask();
    const listed = tasks.has(this.#value);

    if (!namesTask || listed) return;

    throw new UnknownTaskError(this.#value, this.#pointer);
  }
}
