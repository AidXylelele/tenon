import { Policy } from '@nestjs/authorization';
import type { User } from '../../../domain/identity/user.js';

// Editors create, list and delete webhooks (FR-024).
@Policy()
export class WebhookPolicy {
  manage(user: User | null): boolean {
    if (user === null) return false;

    return user.isAdmin || user.isEditor;
  }
}
