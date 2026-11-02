import { Policy } from '@nestjs/authorization';
import type { User } from '../../../domain/identity/user.js';

@Policy()
export class InstancePolicy {
  operate(user: User | null): boolean {
    if (user === null) return false;

    return user.isAdmin || user.isEditor;
  }
}
