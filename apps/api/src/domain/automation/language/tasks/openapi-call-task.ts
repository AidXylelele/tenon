import type { Authentication } from '../authentication.js';
import type { CallOutput } from '../call-output.js';
import type { Endpoint } from '../endpoint.js';
import { CallKind } from '../enums.js';
import type {
  JsonValue,
  OpenApiCallTaskProps,
  ServiceCall,
} from '../interfaces.js';
import type { RoundResults } from '../round-results.js';
import { CallTask } from './call-task.js';
import type { Template } from '../template.js';
import type { WorkKey } from '../work-key.js';

export class OpenApiCallTask extends CallTask {
  readonly #document: Endpoint;
  readonly #arguments: Template;
  readonly #output: CallOutput;
  readonly #authentication: Authentication | null;

  constructor(props: OpenApiCallTaskProps) {
    super(props);
    this.#document = props.document;
    this.#arguments = props.arguments;
    this.#output = props.output;
    this.#authentication = props.authentication;
  }

  get document(): Endpoint {
    return this.#document;
  }

  get arguments(): Template {
    return this.#arguments;
  }

  get authentication(): Authentication | null {
    return this.#authentication;
  }

  get output(): CallOutput {
    return this.#output;
  }

  get templates(): readonly Template[] {
    const document = this.#document.templates;
    const settings = this.#authentication?.settings;

    if (settings === undefined) return document.concat(this.#arguments);

    return document.concat(this.#arguments, settings);
  }

  protected callFrom(
    id: string,
    key: WorkKey,
    results: RoundResults,
    input: JsonValue,
    deadline: Date | null,
  ): ServiceCall {
    const endpoint = this.#document.filled(key, results);
    const args = this.#arguments.fill(key, results);
    const authentication = this.#authentication?.filled(key, results) ?? null;
    return {
      id,
      kind: CallKind.OpenApi,
      endpoint,
      arguments: args,
      authentication,
      input,
      deadline,
    };
  }
}
