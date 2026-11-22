import { randomUUID } from "node:crypto";
import type { Result } from "../../interfaces.js";
import type { SecretRefusal } from "./enums.js";
import type { NewSecret, SecretProps } from "./interfaces.js";
import { SecretValue } from "./secret-value.js";

export class Secret {
  readonly #id: string;
  readonly #ownerId: string;
  readonly #name: string;
  readonly #createdAt: Date;
  readonly #version: number;
  #value: SecretValue;
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

  static create(input: NewSecret): Result<Secret, SecretRefusal> {
    const value = SecretValue.of(input.value);

    if (!value.ok) return value;

    const id = randomUUID();
    const secret = new Secret({
      id,
      ownerId: input.ownerId,
      name: input.name,
      value: value.value,
      createdAt: input.now,
      updatedAt: input.now,
      version: 0,
    });
    return { ok: true, value: secret };
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

  get value(): SecretValue {
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

  replace(text: string, now: Date): Result<void, SecretRefusal> {
    const value = SecretValue.of(text);

    if (!value.ok) return value;

    this.#value = value.value;
    this.#updatedAt = now;
    return { ok: true, value: undefined };
  }
}
