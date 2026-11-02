import type { CallOutput } from '../call-output.js';
import type { Endpoint } from '../endpoint.js';
import { CallKind } from '../enums.js';
import type {
  HttpCallTaskProps,
  JsonValue,
  ServiceCall,
} from '../interfaces.js';
import type { RoundResults } from '../round-results.js';
import { CallTask } from './call-task.js';
import type { Template } from '../template.js';

export class HttpCallTask extends CallTask {
  readonly #endpoint: Endpoint;
  readonly #arguments: Template;
  readonly #output: CallOutput;

  constructor(props: HttpCallTaskProps) {
    super(props);
    this.#endpoint = props.endpoint;
    this.#arguments = props.arguments;
    this.#output = props.output;
  }

  get endpoint(): Endpoint {
    return this.#endpoint;
  }

  get arguments(): Template {
    return this.#arguments;
  }

  get output(): CallOutput {
    return this.#output;
  }

  get templates(): readonly Template[] {
    const endpoint = this.#endpoint.templates;
    return endpoint.concat(this.#arguments);
  }

  protected callFrom(
    id: string,
    prefix: string,
    results: RoundResults,
    input: JsonValue,
    deadline: Date | null,
  ): ServiceCall {
    const endpoint = this.#endpoint.filled(prefix, results);
    const args = this.#arguments.fill(prefix, results);
    return {
      id,
      kind: CallKind.Http,
      endpoint,
      arguments: args,
      authentication: null,
      input,
      deadline,
    };
  }
}
