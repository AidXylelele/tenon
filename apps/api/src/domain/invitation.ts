import { randomUUID } from 'node:crypto';
import {
  InvitationExpiredError,
  InvitationRevokedError,
  InvitationUsedError,
} from './errors.js';
import { InvitationStatus, type Role } from './enums.js';
import type { InvitationProps, NewInvitation } from './interfaces.js';

export class Invitation {
  static readonly LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

  readonly #id: string;
  readonly #email: string;
  readonly #role: Role;
  readonly #tokenHash: string;
  readonly #expiresAt: Date;
  readonly #invitedBy: string;
  readonly #createdAt: Date;
  readonly #version: number;
  #status: InvitationStatus;
  #acceptedAt: Date | null;
  #acceptedUserId: string | null;
  #revokedAt: Date | null;

  constructor(props: InvitationProps) {
    this.#id = props.id;
    this.#email = props.email;
    this.#role = props.role;
    this.#tokenHash = props.tokenHash;
    this.#status = props.status;
    this.#expiresAt = props.expiresAt;
    this.#invitedBy = props.invitedBy;
    this.#acceptedAt = props.acceptedAt;
    this.#acceptedUserId = props.acceptedUserId;
    this.#createdAt = props.createdAt;
    this.#revokedAt = props.revokedAt;
    this.#version = props.version;
  }

  static create(input: NewInvitation): Invitation {
    const now = new Date();
    return new Invitation({
      id: randomUUID(),
      email: input.email,
      role: input.role,
      tokenHash: input.token.hash,
      status: InvitationStatus.Pending,
      expiresAt: new Date(now.getTime() + Invitation.LIFETIME_MS),
      invitedBy: input.invitedBy,
      acceptedAt: null,
      acceptedUserId: null,
      createdAt: now,
      revokedAt: null,
      version: 1,
    });
  }

  get id(): string {
    return this.#id;
  }

  get email(): string {
    return this.#email;
  }

  get role(): Role {
    return this.#role;
  }

  get tokenHash(): string {
    return this.#tokenHash;
  }

  get status(): InvitationStatus {
    return this.#status;
  }

  get expiresAt(): Date {
    return this.#expiresAt;
  }

  get invitedBy(): string {
    return this.#invitedBy;
  }

  get acceptedAt(): Date | null {
    return this.#acceptedAt;
  }

  get acceptedUserId(): string | null {
    return this.#acceptedUserId;
  }

  get createdAt(): Date {
    return this.#createdAt;
  }

  get revokedAt(): Date | null {
    return this.#revokedAt;
  }

  get version(): number {
    return this.#version;
  }

  isExpired(): boolean {
    return (
      this.#status === InvitationStatus.Pending &&
      this.#expiresAt.getTime() <= Date.now()
    );
  }

  assertPending(): void {
    if (this.#status === InvitationStatus.Accepted)
      throw new InvitationUsedError();

    if (this.#status === InvitationStatus.Revoked)
      throw new InvitationRevokedError();

    if (this.isExpired()) throw new InvitationExpiredError();
  }

  accept(userId: string): void {
    this.assertPending();

    this.#status = InvitationStatus.Accepted;
    this.#acceptedAt = new Date();
    this.#acceptedUserId = userId;
  }

  revoke(): void {
    if (this.#status === InvitationStatus.Accepted)
      throw new InvitationUsedError();

    if (this.#status === InvitationStatus.Revoked)
      throw new InvitationRevokedError();

    this.#status = InvitationStatus.Revoked;
    this.#revokedAt = new Date();
  }
}
