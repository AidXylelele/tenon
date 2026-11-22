export interface AccountProps {
  readonly id: string;
  readonly userId: string;
  readonly identifier: string;
  readonly passwordHash: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}
