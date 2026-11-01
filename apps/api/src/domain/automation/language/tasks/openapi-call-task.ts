import type { Authentication } from '../authentication.js';
import type { CallOutput } from '../call-output.js';
import type { Endpoint } from '../endpoint.js';
import { CallKind } from '../enums.js';
import type { Expression } from '../expression.js';
import type {
  CallTask,
  JsonValue,
  OpenApiCallTaskProps,
  ServiceCall,
} from '../interfaces.js';
import { CallProgress } from '../progress/call-progress.js';
import type { KindProgress } from '../progress/kind-progress.js';
import type { Step } from '../step.js';
import type { TaskScope } from '../scopes/task-scope.js';
import type { RoundResults } from '../round-results.js';
import { Task } from './task.js';
import type { Template } from '../template.js';

export class OpenApiCallTask extends Task implements CallTask {
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

  enter(input: JsonValue, scope: TaskScope): Step<KindProgress> {
    return CallProgress.enter(input, scope);
  }

  callFrom(
    id: string,
    prefix: string,
    results: RoundResults,
    input: JsonValue,
  ): ServiceCall {
    const endpoint = this.#document.filled(prefix, results);
    const args = this.#arguments.fill(prefix, results);
    const authentication =
      this.#authentication?.filled(prefix, results) ?? null;
    return {
      id,
      kind: CallKind.OpenApi,
      endpoint,
      arguments: args,
      authentication,
      input,
    };
  }

  protected override get ownExpressions(): readonly Expression[] {
    const document = this.#document.expressions;
    const args = this.#arguments.expressions;
    const authentication = this.#authentication?.expressions ?? [];
    return document.concat(args, authentication);
  }
}
