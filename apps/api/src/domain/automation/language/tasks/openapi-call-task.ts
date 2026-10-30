import type { Authentication } from '../authentication.js';
import type { Endpoint } from '../endpoint.js';
import type { Expression } from '../expression.js';
import type { OpenApiCallTaskProps } from '../interfaces.js';
import { Task } from '../task.js';
import type { Template } from '../template.js';

export class OpenApiCallTask extends Task {
  readonly #document: Endpoint;
  readonly #arguments: Template;
  readonly #authentication: Authentication | null;

  constructor(props: OpenApiCallTaskProps) {
    super(props);
    this.#document = props.document;
    this.#arguments = props.arguments;
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

  protected override get ownExpressions(): readonly Expression[] {
    const document = this.#document.expressions;
    const args = this.#arguments.expressions;
    const authentication = this.#authentication?.expressions ?? [];
    return document.concat(args, authentication);
  }
}
