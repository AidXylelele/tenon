import type { Role, UserStatus } from "./enums.js";

export interface UserProps {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly status: UserStatus;
  readonly createdAt: Date;
}

export interface NewUser {
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly now: Date;
}
