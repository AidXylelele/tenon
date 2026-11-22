import { randomUUID } from "node:crypto";
import type { Result } from "../../interfaces.js";
import type { Role } from "../users/enums.js";
import type { User } from "../users/user.js";
import { InvitationRefusal, InvitationStatus } from "./enums.js";
import type { InvitationProps, NewInvitation } from "./interfaces.js";

export class Invitation {
  static readonly #LIFETIME = Temporal.Duration.from({ days: 7 });

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

  static create(input: NewInvitation): Result<Invitation, InvitationRefusal> {
    if (input.holder !== null)
      return { ok: false, failure: InvitationRefusal.EmailTaken };

    const now = input.now.getTime();
    const created = Temporal.Instant.fromEpochMilliseconds(now);
    const expiry = created.toZonedDateTimeISO("UTC").add(Invitation.#LIFETIME);
    const expiresAt = new Date(expiry.epochMilliseconds);
    const id = randomUUID();
    const invitation = new Invitation({
      id,
      email: input.email,
      role: input.role,
      tokenHash: input.token.hash,
      status: InvitationStatus.Pending,
      expiresAt,
      invitedBy: input.invitedBy,
      acceptedAt: null,
      acceptedUserId: null,
      createdAt: input.now,
      revokedAt: null,
      version: 0,
    });
    return { ok: true, value: invitation };
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

  pendingAt(now: Date): Result<void, InvitationRefusal> {
    const closed = this.#closedRefusal();

    if (closed !== null) return { ok: false, failure: closed };

    const expired = this.#isExpired(now);

    if (expired) return { ok: false, failure: InvitationRefusal.Expired };

    return { ok: true, value: undefined };
  }

  accept(
    user: User,
    holder: User | null,
    now: Date,
  ): Result<void, InvitationRefusal> {
    const pending = this.pendingAt(now);

    if (!pending.ok) return pending;

    if (holder !== null)
      return { ok: false, failure: InvitationRefusal.EmailTaken };

    this.#status = InvitationStatus.Accepted;
    this.#acceptedAt = now;
    this.#acceptedUserId = user.id;
    return { ok: true, value: undefined };
  }

  revoke(now: Date): Result<void, InvitationRefusal> {
    const closed = this.#closedRefusal();

    if (closed !== null) return { ok: false, failure: closed };

    this.#status = InvitationStatus.Revoked;
    this.#revokedAt = now;
    return { ok: true, value: undefined };
  }

  #isExpired(now: Date): boolean {
    const expiry = this.#expiresAt.getTime();
    const moment = now.getTime();
    return expiry <= moment;
  }

  #closedRefusal(): InvitationRefusal | null {
    if (this.#status === InvitationStatus.Accepted)
      return InvitationRefusal.Accepted;

    if (this.#status === InvitationStatus.Revoked)
      return InvitationRefusal.Revoked;

    return null;
  }
}
