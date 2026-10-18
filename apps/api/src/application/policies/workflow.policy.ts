import { Policy } from '@nestjs/authorization';
import type { User } from '../../domain/user.js';

@Policy()
export class WorkflowPolicy {
  author(user: User | null): boolean {
    if (!user) return false;

    return user.isAdmin || user.isEditor;
  }

  manage(user: User | null, workflow: { readonly ownerId: string }): boolean {
    if (!user) return false;

    if (user.isAdmin) return true;

    return user.isEditor && user.id === workflow.ownerId;
  }
}
