import type { ErrorType } from './error-type.js';
import type { WorkflowErrorProps } from './interfaces.js';

export class WorkflowError {
  readonly #type: string;
  readonly #status: number;
  readonly #instance: string | null;
  readonly #title: string | null;
  readonly #detail: string | null;

  constructor(props: WorkflowErrorProps) {
    this.#type = props.type;
    this.#status = props.status;
    this.#instance = props.instance;
    this.#title = props.title;
    this.#detail = props.detail;
  }

  static of(
    type: ErrorType,
    instance: string,
    detail: string | null,
  ): WorkflowError {
    return new WorkflowError({
      type: type.uri,
      status: type.status,
      instance,
      title: null,
      detail,
    });
  }

  get type(): string {
    return this.#type;
  }

  get status(): number {
    return this.#status;
  }

  get instance(): string | null {
    return this.#instance;
  }

  get title(): string | null {
    return this.#title;
  }

  get detail(): string | null {
    return this.#detail;
  }

  property(name: string): string | number | null {
    if (name === 'type') return this.#type;

    if (name === 'status') return this.#status;

    if (name === 'instance') return this.#instance;

    if (name === 'title') return this.#title;

    if (name === 'detail') return this.#detail;

    return null;
  }
}
