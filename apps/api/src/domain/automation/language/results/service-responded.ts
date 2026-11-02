import type { CallOutput } from '../call-output.js';
import type {
  JsonObject,
  JsonValue,
  ServiceRespondedProps,
} from '../interfaces.js';
import type { JsonPointer } from '../json-pointer.js';
import { ErrorType } from '../error-type.js';
import { NulCharacter } from '../nul-character.js';
import { Outcome } from '../outcome.js';
import { ServiceResult } from './service-result.js';

export class ServiceResponded extends ServiceResult {
  static readonly #HOLDS_NUL =
    'The response content holds a NUL character, which a value cannot hold';

  readonly #status: number;
  readonly #headers: JsonObject;
  readonly #content: JsonValue;
  readonly #body: string;
  readonly #request: JsonObject;
  readonly #authorization: JsonObject | null;

  constructor(props: ServiceRespondedProps) {
    super(props.id);
    this.#status = props.status;
    this.#headers = props.headers;
    this.#content = props.content;
    this.#body = props.body;
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

  get body(): string {
    return this.#body;
  }

  get request(): JsonObject {
    return this.#request;
  }

  get authorization(): JsonObject | null {
    return this.#authorization;
  }

  outcome(output: CallOutput, at: JsonPointer): Outcome {
    const outcome = output.outcomeOf(this, at);
    const unrecordable = NulCharacter.isIn(outcome.output);

    if (!unrecordable) return outcome;

    const error = ErrorType.Communication.errorAt(
      at,
      ServiceResponded.#HOLDS_NUL,
    );
    return Outcome.failed(error);
  }
}
