import type { Definition } from '../language/definition.js';
import type { JsonObject } from '../language/interfaces.js';
import type { RoundContextProps } from './interfaces.js';

// What a round runs with: the Definition of the instance's version, `$runtime` and the time.
export class RoundContext {
  readonly #definition: Definition;
  readonly #runtime: JsonObject;
  readonly #now: Date;

  constructor(props: RoundContextProps) {
    this.#definition = props.definition;
    this.#runtime = props.runtime;
    this.#now = props.now;
  }

  get definition(): Definition {
    return this.#definition;
  }

  get runtime(): JsonObject {
    return this.#runtime;
  }

  get now(): Date {
    return this.#now;
  }

  // The same round later: each answer is recorded at the time it arrived (architecture §3).
  at(now: Date): RoundContext {
    return new RoundContext({
      definition: this.#definition,
      runtime: this.#runtime,
      now,
    });
  }
}
