import type { Secret } from "../../../domain/automation/secrets/secret.js";

export abstract class SecretRepository {
  abstract find(ownerId: string, name: string): Promise<Secret | null>;
  abstract findOwnedBy(ownerId: string): Promise<Secret[]>;
  abstract findDeclared(versionId: string): Promise<Secret[]>;
  abstract save(secret: Secret): Promise<void>;
  abstract remove(secret: Secret): Promise<void>;
}
