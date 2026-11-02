import type { User } from '../../../domain/identity/user.js';

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: User;
  }
}
