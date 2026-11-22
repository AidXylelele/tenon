import { Injectable } from "@nestjs/common";
import type { SignedInUser } from "../../../application/identity/users/interfaces.js";
import type { User } from "../../../domain/identity/users/user.js";
import type { SessionResponse, UserResponse } from "../schemas/auth.schema.js";

@Injectable()
export class UserPresenter {
  user(user: User | SignedInUser): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  session(user: User | SignedInUser): SessionResponse {
    const presented = this.user(user);
    const capabilities = {
      author: user.mayChangeAutomation,
      operator: user.mayChangeAutomation,
      administrator: user.isAdmin,
    };
    return { user: presented, capabilities };
  }
}
