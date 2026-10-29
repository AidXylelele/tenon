export class WorkflowName {
  readonly #namespace: string;
  readonly #name: string;

  constructor(namespace: string, name: string) {
    this.#namespace = namespace;
    this.#name = name;
  }

  get namespace(): string {
    return this.#namespace;
  }

  get name(): string {
    return this.#name;
  }

  equals(other: WorkflowName): boolean {
    return this.#namespace === other.#namespace && this.#name === other.#name;
  }

  toString(): string {
    return `${this.#namespace}/${this.#name}`;
  }
}
