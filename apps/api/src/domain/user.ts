import { randomUUID } from 'node:crypto';
import { Role, UserStatus } from './enums.js';
import type { NewUser, UserProps } from './interfaces.js';

export class User {
  readonly #id: string;
  readonly #email: string;
  readonly #name: string;
  readonly #role: Role;
  readonly #status: UserStatus;
  readonly #createdAt: Date;

  constructor(props: UserProps) {
    this.#id = props.id;
    this.#email = props.email;
    this.#name = props.name;
    this.#role = props.role;
    this.#status = props.status;
    this.#createdAt = props.createdAt;
  }

  static create(input: NewUser): User {
    return new User({
      id: randomUUID(),
      email: input.email,
      name: input.name,
      role: input.role,
      status: UserStatus.Active,
      createdAt: new Date(),
    });
  }

  get id(): string {
    return this.#id;
  }

  get email(): string {
    return this.#email;
  }

  get name(): string {
    return this.#name;
  }

  get role(): Role {
    return this.#role;
  }

  get status(): UserStatus {
    return this.#status;
  }

  get createdAt(): Date {
    return this.#createdAt;
  }

  get isAdmin(): boolean {
    return this.#role === Role.Admin;
  }

  get isEditor(): boolean {
    return this.#role === Role.Editor;
  }

  get isActive(): boolean {
    return this.#status === UserStatus.Active;
  }
}
