import { ParameterError } from './parameter-error.js';
import type { ParameterValue } from './parameter-value.js';

export class MalformedValue implements ParameterValue {
  readonly #path: string;
  readonly #raw: unknown;

  constructor(path: string, raw: unknown) {
    this.#path = path;
    this.#raw = raw;
  }

  get path(): string {
    return this.#path;
  }

  get isDynamic(): boolean {
    return false;
  }

  resolve(): unknown {
    throw new ParameterError(
      this.#path,
      'The value must be a fixed value, a field reference or a formula',
      false,
    );
  }

  sketch(): undefined {
    return undefined;
  }

  leaves(): ParameterValue[] {
    return [this];
  }

  renameNodes(): unknown {
    return this.#raw;
  }
}
