import type { User } from "../../../domain/identity/users/user.js";

declare module "@nestjs/authentication" {
  interface AuthenticationTypes {
    user: User;
  }
}
