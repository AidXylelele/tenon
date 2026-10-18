import type { ParameterValue } from './parameter-value.js';
import type { ResolutionContext } from './resolution-context.js';

export class FieldReference implements ParameterValue {
  readonly #path: string;
  readonly #node: string;
  readonly #field: string;

  constructor(path: string, node: string, field: string) {
    this.#path = path;
    this.#node = node;
    this.#field = field;
  }

  get path(): string {
    return this.#path;
  }

  get isDynamic(): boolean {
    return true;
  }

  get node(): string {
    return this.#node;
  }

  get field(): string {
    return this.#field;
  }

  resolve(context: ResolutionContext): unknown {
    return context.field(this.#node, this.#field);
  }

  sketch(): undefined {
    return undefined;
  }

  leaves(): ParameterValue[] {
    return [this];
  }

  renameNodes(): unknown {
    return { ref: { node: this.#node, path: this.#field } };
  }
}
