import type { CallOutput } from '../call-output.js';
import type {
  JsonObject,
  JsonValue,
  ServiceRespondedProps,
} from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import type { Outcome } from '../outcome.js';
import { ServiceResult } from './service-result.js';

export class ServiceResponded extends ServiceResult {
  readonly #status: number;
  readonly #headers: JsonObject;
  readonly #content: JsonValue;
  readonly #request: JsonObject;
  readonly #authorization: JsonObject | null;

  constructor(props: ServiceRespondedProps) {
    super(props.id);
    this.#status = props.status;
    this.#headers = props.headers;
    this.#content = props.content;
    this.#request = props.request;
    this.#authorization = props.authorization;
  }

  get status(): number {
    return this.#status;
  }

  get headers(): JsonObject {
    return this.#headers;
  }

  get content(): JsonValue {
    return this.#content;
  }

  get request(): JsonObject {
    return this.#request;
  }

  get authorization(): JsonObject | null {
    return this.#authorization;
  }

  outcome(output: CallOutput, at: JsonPointer): Outcome {
    return output.outcomeOf(this, at);
  }
}
