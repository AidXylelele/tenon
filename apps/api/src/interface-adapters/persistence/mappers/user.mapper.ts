import type { RoleName } from '../../../domain/interfaces.js';
import { User } from '../../../domain/user.js';
import type { UserRow } from '../../interfaces.js';

export class UserMapper {
  static toRow(user: User): UserRow {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      passwordHash: user.passwordHash,
      suspended: user.suspended,
      createdAt: user.createdAt,
    };
  }

  static toEntity(row: UserRow): User {
    return new User({ ...row, role: row.role as RoleName });
  }
}
