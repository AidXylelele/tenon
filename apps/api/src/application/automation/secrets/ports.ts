import type { SecretRefusal } from '../../../domain/automation/secrets/enums.js';
import type { Secret } from '../../../domain/automation/secrets/secret.js';
import type { Result } from '../../../domain/result.js';
import type { Missing } from '../enums.js';

export interface SecretCommand {
  readonly ownerId: string;
  readonly name: string;
}

export interface SecretValueCommand extends SecretCommand {
  readonly value: string;
}

export type CreateSecretResult = Result<Secret, SecretRefusal>;

export type SecretResult = Result<undefined, Missing>;

export abstract class SecretRepository {
  abstract find(ownerId: string, name: string): Promise<Secret | null>;
  // An upsert fenced by the secret's version; a name its owner already took is refused.
  abstract save(secret: Secret): Promise<void>;
  abstract remove(secret: Secret): Promise<void>;
}
