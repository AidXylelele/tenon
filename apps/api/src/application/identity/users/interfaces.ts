import type {
  Role,
  UserRefusal,
} from "../../../domain/identity/users/enums.js";
import type { User } from "../../../domain/identity/users/user.js";
import type { Result } from "../../../domain/interfaces.js";
import type { Missing } from "../enums.js";
import type { MemberStatus } from "./enums.js";

export interface Person {
  readonly id: string;
  readonly name: string;
}

export interface SignedInUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly isAdmin: boolean;
  readonly mayChangeAutomation: boolean;
}

export type SessionUserResult = Result<User, UserRefusal | Missing>;

export interface Member {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly role: Role;
  readonly status: MemberStatus;
  readonly since: Date;
}
