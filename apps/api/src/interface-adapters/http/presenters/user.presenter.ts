import type { User } from '../../../domain/user.js';
import type { UserResponse } from '../dto/responses.dto.js';

export class UserPresenter {
  static user(user: User): UserResponse {
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
