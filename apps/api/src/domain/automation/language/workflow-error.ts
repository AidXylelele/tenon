import { ErrorProperty } from './enums.js';
import type {
  JsonObject,
  JsonValue,
  WorkflowErrorProps,
} from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';

export class WorkflowError {
  readonly #type: string;
  readonly #status: number;
  readonly #instance: string;
  readonly #title: string | null;
  readonly #detail: string | null;

  constructor(props: WorkflowErrorProps) {
    this.#type = props.type;
    this.#status = props.status;
    this.#instance = props.instance;
    this.#title = props.title;
    this.#detail = props.detail;
  }

  get type(): string {
    return this.#type;
  }

  get status(): number {
    return this.#status;
  }

  get instance(): string {
    return this.#instance;
  }

  get title(): string | null {
    return this.#title;
  }

  get detail(): string | null {
    return this.#detail;
  }

  property(name: ErrorProperty): string | number | null {
    if (name === ErrorProperty.Type) return this.#type;

    if (name === ErrorProperty.Status) return this.#status;

    if (name === ErrorProperty.Instance) return this.#instance;

    if (name === ErrorProperty.Title) return this.#title;

    return this.#detail;
  }

  raisedAt(at: JsonPointer): WorkflowError {
    const instance = at.toString();
    return new WorkflowError({
      type: this.#type,
      status: this.#status,
      instance,
      title: this.#title,
      detail: this.#detail,
    });
  }

  toJson(): JsonObject {
    const json: Record<string, JsonValue> = {
      type: this.#type,
      status: this.#status,
      instance: this.#instance,
    };

    if (this.#title !== null) json.title = this.#title;

    if (this.#detail !== null) json.detail = this.#detail;

    return json;
  }
}
