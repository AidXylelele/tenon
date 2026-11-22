import type {
  Role,
  UserRefusal,
} from "../../../domain/identity/users/enums.js";
import type { User } from "../../../domain/identity/users/user.js";
import type { Result } from "../../../domain/interfaces.js";
import type { Missing } from "../enums.js";

export interface SignedInUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly isAdmin: boolean;
  readonly mayChangeAutomation: boolean;
}

export type SessionUserResult = Result<User, UserRefusal | Missing>;
