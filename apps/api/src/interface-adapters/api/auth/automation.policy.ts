import { Policy } from "@nestjs/authorization";
import type { User } from "../../../domain/identity/user.js";

@Policy()
export class AutomationPolicy {
  change(user: User | null): boolean {
    return user?.mayChangeAutomation ?? false;
  }
}
