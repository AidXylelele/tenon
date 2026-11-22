import type { SecretValue } from "./secret-value.js";

export interface SecretProps {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly value: SecretValue;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface NewSecret {
  readonly ownerId: string;
  readonly name: string;
  readonly value: string;
  readonly now: Date;
}

export interface HeldSecret {
  readonly name: string;
  readonly value: SecretValue;
}
