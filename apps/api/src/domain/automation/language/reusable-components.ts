import { AuthenticationPolicy } from './authentication-policy.js';
import { type Duration, DurationFactory } from './duration-factory.js';
import type { ParsedUse } from './interfaces.js';
import { RetryPolicy } from './retry-policy.js';
import type { Scope } from './scope.js';
import { SupportedSubset } from './supported-subset.js';
import type { Task } from './task.js';
import { TaskFactory } from './task-factory.js';
import { Template } from './template.js';

export class ReusableComponents {
  readonly #authentications = new Map<string, AuthenticationPolicy>();
  readonly #errors = new Map<string, Template>();
  readonly #retries = new Map<string, RetryPolicy>();
  readonly #timeouts = new Map<string, Duration>();
  readonly #functions = new Map<string, Task>();

  static none(): ReusableComponents {
    return new ReusableComponents();
  }

  static read(parsed: ParsedUse | undefined, scope: Scope): ReusableComponents {
    const components = new ReusableComponents();
    const use = parsed ?? {};
    SupportedSubset.acceptsUse(use, scope);
    components.#readAuthentications(use, scope);
    components.#readErrors(use, scope);
    components.#readRetries(use, scope);
    components.#readTimeouts(use, scope);
    components.#readFunctions(use, scope);
    return components;
  }

  authentication(name: string, scope: Scope): AuthenticationPolicy | null {
    const declared = this.#authentications.get(name) ?? null;

    if (declared === null)
      scope.refuse(
        `No authentication named "${name}" is declared in use.authentications`,
      );

    return declared;
  }

  error(name: string, scope: Scope): Template | null {
    const declared = this.#errors.get(name) ?? null;

    if (declared === null)
      scope.refuse(`No error named "${name}" is declared in use.errors`);

    return declared;
  }

  retry(name: string, scope: Scope): RetryPolicy | null {
    const declared = this.#retries.get(name) ?? null;

    if (declared === null)
      scope.refuse(
        `No retry policy named "${name}" is declared in use.retries`,
      );

    return declared;
  }

  timeout(name: string, scope: Scope): Duration | null {
    const declared = this.#timeouts.get(name) ?? null;

    if (declared === null)
      scope.refuse(`No timeout named "${name}" is declared in use.timeouts`);

    return declared;
  }

  function(name: string, scope: Scope): Task | null {
    const declared = this.#functions.get(name) ?? null;

    if (declared === null)
      scope.refuse(`No function named "${name}" is declared in use.functions`);

    return declared;
  }

  #readAuthentications(use: ParsedUse, scope: Scope): void {
    const declared = use.authentications ?? {};
    const section = scope.at('authentications');

    for (const name of Object.keys(declared)) {
      const parsed = declared[name];

      if (parsed === undefined) continue;

      const named = section.at(name);
      const policy = AuthenticationPolicy.read(parsed, named);

      if (policy !== null) this.#authentications.set(name, policy);
    }
  }

  #readErrors(use: ParsedUse, scope: Scope): void {
    const declared = use.errors ?? {};
    const section = scope.at('errors');

    for (const name of Object.keys(declared)) {
      const parsed = declared[name];
      const named = section.at(name);
      const error = Template.read(parsed, named);

      if (error !== null) this.#errors.set(name, error);
    }
  }

  #readRetries(use: ParsedUse, scope: Scope): void {
    const declared = use.retries ?? {};
    const section = scope.at('retries');

    for (const name of Object.keys(declared)) {
      const parsed = declared[name];

      if (parsed === undefined) continue;

      const named = section.at(name);
      const policy = RetryPolicy.read(parsed, named);
      this.#retries.set(name, policy);
    }
  }

  #readTimeouts(use: ParsedUse, scope: Scope): void {
    const declared = use.timeouts ?? {};
    const section = scope.at('timeouts');

    for (const name of Object.keys(declared)) {
      const parsed = declared[name];
      const afterAt = section.at(name).at('after');
      const timeout = DurationFactory.read(parsed?.after, afterAt);

      if (timeout !== null) this.#timeouts.set(name, timeout);
    }
  }

  #readFunctions(use: ParsedUse, scope: Scope): void {
    const declared = use.functions ?? {};
    const section = scope.using(this).at('functions');

    for (const name of Object.keys(declared)) {
      const parsed = declared[name];

      if (parsed === undefined) continue;

      const named = section.at(name);
      const task = TaskFactory.build(name, parsed, named);

      if (task !== null) this.#functions.set(name, task);
    }
  }
}
