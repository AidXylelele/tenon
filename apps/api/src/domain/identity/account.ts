import { randomUUID } from "node:crypto";
import type { AccountProps } from "./interfaces.js";
import type { User } from "./user.js";

export class Account {
  readonly #id: string;
  readonly #userId: string;
  readonly #identifier: string;
  readonly #createdAt: Date;
  readonly #version: number;
  #passwordHash: string;
  #updatedAt: Date;

  constructor(props: AccountProps) {
    this.#id = props.id;
    this.#userId = props.userId;
    this.#identifier = props.identifier;
    this.#passwordHash = props.passwordHash;
    this.#createdAt = props.createdAt;
    this.#updatedAt = props.updatedAt;
    this.#version = props.version;
  }

  static password(user: User, passwordHash: string, now: Date): Account {
    return new Account({
      id: randomUUID(),
      userId: user.id,
      identifier: user.email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  get id(): string {
    return this.#id;
  }

  get userId(): string {
    return this.#userId;
  }

  get identifier(): string {
    return this.#identifier;
  }

  get passwordHash(): string {
    return this.#passwordHash;
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

  changePassword(passwordHash: string, now: Date): void {
    this.#passwordHash = passwordHash;
    this.#updatedAt = now;
  }
}
