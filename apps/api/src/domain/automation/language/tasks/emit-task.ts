import { MalformedEventError } from '../../../errors.js';
import { CloudEvent } from '../cloud-event.js';
import { ErrorType } from '../error-type.js';
import { LifecycleSource } from '../lifecycle-source.js';
import type { EmitTaskProps, JsonValue } from '../interfaces.js';
import { Outcome } from '../outcome.js';
import type { BodyScope } from '../scopes/body-scope.js';
import { ValueTask } from './value-task.js';
import type { Template } from '../template.js';

export class EmitTask extends ValueTask {
  static readonly #MALFORMED =
    'The event to emit is not a well-formed CloudEvent';
  static readonly #RESERVED =
    "The source of the event to emit belongs to the platform's lifecycle events";

  readonly #event: Template;

  constructor(props: EmitTaskProps) {
    super(props);
    const declared = props.event.value;

    if (!CloudEvent.declares(declared))
      throw new MalformedEventError(props.event.pointer);

    this.#event = props.event;
  }

  get template(): Template {
    return this.#event;
  }

  protected outcomeOf(value: JsonValue, scope: BodyScope): Outcome {
    const malformed = ErrorType.Runtime.errorAt(
      this.reference,
      EmitTask.#MALFORMED,
    );

    if (!CloudEvent.declares(value)) return Outcome.failed(malformed);

    const completed = CloudEvent.complete(value, scope.id, scope.now);
    const event = CloudEvent.of(completed);

    if (event === null) return Outcome.failed(malformed);

    const reserved = LifecycleSource.claims(event.source);

    if (reserved) {
      const error = ErrorType.Runtime.errorAt(
        this.reference,
        EmitTask.#RESERVED,
      );
      return Outcome.failed(error);
    }

    return Outcome.emitting(completed, event);
  }
}
