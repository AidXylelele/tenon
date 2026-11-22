import { Injectable } from "@nestjs/common";
import type {
  Member,
  SignedInUser,
} from "../../../application/identity/users/interfaces.js";
import type { User } from "../../../domain/identity/users/user.js";
import type { SessionResponse, UserResponse } from "../schemas/auth.schema.js";
import type { MemberListResponse } from "../schemas/member.schema.js";

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

  members(members: readonly Member[]): MemberListResponse {
    return members.map((member) => ({
      id: member.id,
      email: member.email,
      name: member.name,
      role: member.role,
      status: member.status,
      since: member.since.toISOString(),
    }));
  }
}
