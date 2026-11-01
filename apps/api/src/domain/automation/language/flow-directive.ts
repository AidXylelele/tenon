import {
  BranchJumpError,
  FunctionJumpError,
  UnknownTaskError,
} from '../../errors.js';
import { FlowKeyword } from './enums.js';
import type { JsonPointer } from './json-pointer.js';
import type { TaskList } from './task-list.js';

export class FlowDirective {
  static readonly Continue = new FlowDirective(FlowKeyword.Continue, null);
  static readonly Exit = new FlowDirective(FlowKeyword.Exit, null);
  static readonly End = new FlowDirective(FlowKeyword.End, null);

  static readonly #keywords: readonly FlowDirective[] = [
    FlowDirective.Continue,
    FlowDirective.Exit,
    FlowDirective.End,
  ];

  readonly #name: string;
  readonly #pointer: JsonPointer | null;

  private constructor(name: string, pointer: JsonPointer | null) {
    this.#name = name;
    this.#pointer = pointer;
  }

  static named(name: string | undefined, at: JsonPointer): FlowDirective {
    if (name === undefined) return FlowDirective.Continue;

    const keyword = FlowDirective.#keywords.find(
      (candidate) => candidate.#name === name,
    );
    return keyword ?? new FlowDirective(name, at);
  }

  get name(): string {
    return this.#name;
  }

  get pointer(): JsonPointer | null {
    return this.#pointer;
  }

  endsWorkflow(): boolean {
    return this === FlowDirective.End;
  }

  confirmWithin(tasks: ReadonlySet<string>): void {
    if (this.#pointer === null || tasks.has(this.#name)) return;

    throw new UnknownTaskError(this.#name, this.#pointer);
  }

  confirmInBranch(): void {
    if (this.#pointer === null) return;

    throw new BranchJumpError(this.#name, this.#pointer);
  }

  confirmInFunction(): void {
    if (this.#pointer === null) return;

    throw new FunctionJumpError(this.#name, this.#pointer);
  }

  nextAfter(position: number, list: TaskList): number | null {
    if (this.#pointer !== null) return list.positionOf(this.#name);

    if (this !== FlowDirective.Continue) return null;

    const next = position + 1;

    if (next >= list.tasks.length) return null;

    return next;
  }
}
