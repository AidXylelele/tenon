import { Policy } from '@nestjs/authorization';
import type { User } from '../../../domain/identity/user.js';

// Authors keep the credentials their workflows and subscriptions use (US8).
@Policy()
export class SecretPolicy {
  manage(user: User | null): boolean {
    if (user === null) return false;

    return user.isAdmin || user.isEditor;
  }
}
