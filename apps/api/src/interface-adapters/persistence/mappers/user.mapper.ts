import { Injectable } from "@nestjs/common";
import { User } from "../../../domain/identity/user.js";
import type { UserRow } from "../interfaces.js";

@Injectable()
export class UserMapper {
  toRow(user: User): UserRow {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  toEntity(row: UserRow): User {
    return new User({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt,
    });
  }
}
