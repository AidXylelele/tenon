import { randomUUID } from 'node:crypto';
import type { NewSecret, SecretProps } from './interfaces.js';

// A credential its owner keeps by name for the workflows they publish (FR-007); the value is
// never shown, and is encrypted wherever it is stored.
export class Secret {
  readonly #id: string;
  readonly #ownerId: string;
  readonly #name: string;
  readonly #createdAt: Date;
  readonly #version: number;
  #value: string;
  #updatedAt: Date;

  constructor(props: SecretProps) {
    this.#id = props.id;
    this.#ownerId = props.ownerId;
    this.#name = props.name;
    this.#value = props.value;
    this.#createdAt = props.createdAt;
    this.#updatedAt = props.updatedAt;
    this.#version = props.version;
  }

  static create(input: NewSecret): Secret {
    const id = randomUUID();
    return new Secret({
      id,
      ownerId: input.ownerId,
      name: input.name,
      value: input.value,
      createdAt: input.now,
      updatedAt: input.now,
      version: 0,
    });
  }

  get id(): string {
    return this.#id;
  }

  get ownerId(): string {
    return this.#ownerId;
  }

  get name(): string {
    return this.#name;
  }

  get value(): string {
    return this.#value;
  }

  get createdAt(): Date {
    return this.#createdAt;
  }

  get updatedAt(): Date {
    return this.#updatedAt;
  }

  get version(): number {
    return this.#version;
  }

  // Later resolutions use the new value (US8 AS2).
  replace(value: string, now: Date): void {
    this.#value = value;
    this.#updatedAt = now;
  }
}
