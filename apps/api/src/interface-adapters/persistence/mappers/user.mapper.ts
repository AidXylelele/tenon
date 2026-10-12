import { User } from '../../../domain/user.js';
import type { UserRow } from '../../interfaces.js';

export class UserMapper {
  static toRow(user: User): UserRow {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  static toEntity(row: UserRow): User {
    return new User(row);
  }
}
