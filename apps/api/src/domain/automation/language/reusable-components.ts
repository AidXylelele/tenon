import { UndeclaredComponentError } from '../../errors.js';
import type { Authentication } from './authentication.js';
import { Component } from './enums.js';
import type { Expression } from './expression.js';
import type { ExpressionDuration } from './expression-duration.js';
import type { FixedDuration } from './fixed-duration.js';
import type { ReusableComponentsProps } from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';
import type { RetryStrategy } from './retry-strategy.js';
import type { Task } from './task.js';
import type { Template } from './template.js';

export class ReusableComponents {
  readonly #authentications: ReadonlyMap<string, Authentication>;
  readonly #errors: ReadonlyMap<string, Template>;
  readonly #retries: ReadonlyMap<string, RetryStrategy>;
  readonly #timeouts: ReadonlyMap<string, FixedDuration | ExpressionDuration>;
  readonly #functions: ReadonlyMap<string, Task>;

  constructor(props: ReusableComponentsProps) {
    this.#authentications = props.authentications;
    this.#errors = props.errors;
    this.#retries = props.retries;
    this.#timeouts = props.timeouts;
    this.#functions = props.functions;
  }

  static none(): ReusableComponents {
    const authentications = new Map<string, Authentication>();
    const errors = new Map<string, Template>();
    const retries = new Map<string, RetryStrategy>();
    const timeouts = new Map<string, FixedDuration | ExpressionDuration>();
    const functions = new Map<string, Task>();
    return new ReusableComponents({
      authentications,
      errors,
      retries,
      timeouts,
      functions,
    });
  }

  get expressions(): readonly Expression[] {
    const found: Expression[] = [];
    const authentications = Array.from(this.#authentications.values());
    const errors = Array.from(this.#errors.values());
    const retries = Array.from(this.#retries.values());
    const timeouts = Array.from(this.#timeouts.values());
    const functions = Array.from(this.#functions.values());
    const components = [authentications, errors, retries, timeouts, functions];

    for (const declared of components)
      for (const component of declared)
        for (const expression of component.expressions) found.push(expression);

    return found;
  }

  confirmCalls(): void {
    for (const declared of this.#functions.values())
      declared.confirmCalls(this);
  }

  authentication(name: string, at: JsonPointer): Authentication {
    const declared = this.#authentications.get(name);

    if (declared === undefined)
      throw this.#undeclared(Component.Authentications, name, at);

    return declared;
  }

  error(name: string, at: JsonPointer): Template {
    const declared = this.#errors.get(name);

    if (declared === undefined)
      throw this.#undeclared(Component.Errors, name, at);

    return declared;
  }

  retry(name: string, at: JsonPointer): RetryStrategy {
    const declared = this.#retries.get(name);

    if (declared === undefined)
      throw this.#undeclared(Component.Retries, name, at);

    return declared;
  }

  timeout(name: string, at: JsonPointer): FixedDuration | ExpressionDuration {
    const declared = this.#timeouts.get(name);

    if (declared === undefined)
      throw this.#undeclared(Component.Timeouts, name, at);

    return declared;
  }

  function(name: string, at: JsonPointer): Task {
    const declared = this.#functions.get(name);

    if (declared === undefined)
      throw this.#undeclared(Component.Functions, name, at);

    return declared;
  }

  #undeclared(
    component: Component,
    name: string,
    at: JsonPointer,
  ): UndeclaredComponentError {
    return new UndeclaredComponentError(component, name, at);
  }
}
