import { Policy } from '@nestjs/authorization';
import type { User } from '../../domain/user.js';

@Policy()
export class InvitationPolicy {
  manage(user: User | null): boolean {
    return user?.isAdmin ?? false;
  }
}
