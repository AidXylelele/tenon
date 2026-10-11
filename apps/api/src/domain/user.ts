import { randomUUID } from 'node:crypto';
import type { NewUser, RoleName, UserProps } from './interfaces.js';

export class User {
  static readonly ROLES: readonly RoleName[] = ['admin', 'editor', 'viewer'];

  readonly #id: string;
  readonly #email: string;
  readonly #name: string;
  readonly #role: RoleName;
  readonly #suspended: boolean;
  readonly #createdAt: Date;
  #passwordHash: string | null;

  constructor(props: UserProps) {
    this.#id = props.id;
    this.#email = props.email;
    this.#name = props.name;
    this.#role = props.role;
    this.#passwordHash = props.passwordHash;
    this.#suspended = props.suspended;
    this.#createdAt = props.createdAt;
  }

  static create(input: NewUser): User {
    return new User({
      id: randomUUID(),
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash: input.passwordHash,
      suspended: false,
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

  get role(): RoleName {
    return this.#role;
  }

  get passwordHash(): string | null {
    return this.#passwordHash;
  }

  get suspended(): boolean {
    return this.#suspended;
  }

  get createdAt(): Date {
    return this.#createdAt;
  }

  get isAdmin(): boolean {
    return this.#role === 'admin';
  }

  changePassword(passwordHash: string): void {
    this.#passwordHash = passwordHash;
  }
}
