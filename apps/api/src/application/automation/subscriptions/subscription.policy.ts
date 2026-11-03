import { Policy } from '@nestjs/authorization';
import type { User } from '../../../domain/identity/user.js';

// Editors subscribe their applications to events (FR-025).
@Policy()
export class SubscriptionPolicy {
  manage(user: User | null): boolean {
    if (user === null) return false;

    return user.isAdmin || user.isEditor;
  }
}
