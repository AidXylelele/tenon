import type { SecretRefusal } from "../../../domain/automation/secrets/enums.js";
import type { Result } from "../../../domain/interfaces.js";
import type { Missing } from "../enums.js";

export interface SecretCommand {
  readonly ownerId: string;
  readonly name: string;
}

export interface SecretValueCommand extends SecretCommand {
  readonly value: string;
}

export type CreateSecretResult = Result<SecretView, SecretRefusal>;

export type SecretResult = Result<void, Missing>;

export type ReplaceSecretResult = Result<void, Missing | SecretRefusal>;

export interface SecretView {
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SecretUse {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
}

export interface ListedSecret extends SecretView {
  readonly usedBy: readonly SecretUse[];
}
