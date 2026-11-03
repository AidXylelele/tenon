export interface SecretProps {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly value: string;
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
