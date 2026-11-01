import { randomUUID } from 'node:crypto';
import { AccountWithoutPasswordError } from '../errors.js';
import { AccountType } from './enums.js';
import type { AccountProps } from './interfaces.js';
import type { User } from './user.js';

export class Account {
  readonly #id: string;
  readonly #userId: string;
  readonly #type: AccountType;
  readonly #identifier: string;
  readonly #createdAt: Date;
  readonly #version: number;
  #passwordHash: string | null;
  #updatedAt: Date;

  constructor(props: AccountProps) {
    this.#id = props.id;
    this.#userId = props.userId;
    this.#type = props.type;
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
      type: AccountType.Password,
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

  get type(): AccountType {
    return this.#type;
  }

  get identifier(): string {
    return this.#identifier;
  }

  get passwordHash(): string | null {
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
    if (this.#type !== AccountType.Password) {
      throw new AccountWithoutPasswordError();
    }

    this.#passwordHash = passwordHash;
    this.#updatedAt = now;
  }
}
