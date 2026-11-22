import type { HeldSecret } from "../../../domain/automation/secrets/interfaces.js";
import type { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import type { ListedSecret } from "./interfaces.js";

export abstract class SecretQueries {
  abstract list(ownerId: string): Promise<ListedSecret[]>;
  abstract ofInstance(instanceId: string): Promise<RunSecrets>;
  abstract heldBy(ownerId: string, name: string): Promise<HeldSecret | null>;
}
