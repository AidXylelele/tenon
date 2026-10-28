import type { User } from '../../../domain/identity/user.js';
import type { UserResponse } from '../schemas/auth.schemas.js';

export class UserPresenter {
  static user(user: User): UserResponse {
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
