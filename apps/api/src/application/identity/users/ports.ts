import type { User } from "../../../domain/identity/users/user.js";

export abstract class UserRepository {
  abstract add(user: User): Promise<void>;
  abstract find(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
}
