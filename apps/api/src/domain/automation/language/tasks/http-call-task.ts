import type { Endpoint } from '../endpoint.js';
import type { Expression } from '../expression.js';
import type { HttpCallTaskProps } from '../interfaces.js';
import { Task } from '../task.js';
import type { Template } from '../template.js';

export class HttpCallTask extends Task {
  readonly #endpoint: Endpoint;
  readonly #arguments: Template;

  constructor(props: HttpCallTaskProps) {
    super(props);
    this.#endpoint = props.endpoint;
    this.#arguments = props.arguments;
  }

  get endpoint(): Endpoint {
    return this.#endpoint;
  }

  get arguments(): Template {
    return this.#arguments;
  }

  protected override get ownExpressions(): readonly Expression[] {
    const endpoint = this.#endpoint.expressions;
    const args = this.#arguments.expressions;
    return endpoint.concat(args);
  }
}
