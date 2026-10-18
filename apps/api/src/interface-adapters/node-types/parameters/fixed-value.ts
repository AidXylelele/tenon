import type { ParameterValue } from './parameter-value.js';

export class FixedValue implements ParameterValue {
  readonly #path: string;
  readonly #value: unknown;

  constructor(path: string, value: unknown) {
    this.#path = path;
    this.#value = value;
  }

  get path(): string {
    return this.#path;
  }

  get isDynamic(): boolean {
    return false;
  }

  get value(): unknown {
    return this.#value;
  }

  resolve(): unknown {
    return this.#value;
  }

  sketch(): unknown {
    return this.#value;
  }

  leaves(): ParameterValue[] {
    return [this];
  }

  renameNodes(): unknown {
    return { fixed: this.#value };
  }
}
