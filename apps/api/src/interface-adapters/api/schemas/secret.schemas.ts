import { z } from 'zod';

const SecretName = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/);

const SecretValue = z.string().min(1).max(16_384);

export const CreateSecretBody = z.strictObject({
  name: SecretName,
  value: SecretValue,
});

export type CreateSecretBody = z.infer<typeof CreateSecretBody>;

export const ReplaceSecretBody = z.strictObject({ value: SecretValue });

export type ReplaceSecretBody = z.infer<typeof ReplaceSecretBody>;

export const SecretParams = z.strictObject({ name: SecretName });

export type SecretParams = z.infer<typeof SecretParams>;

// A secret as the API shows it: never its value.
export const SecretResponse = z.object({
  name: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type SecretResponse = z.infer<typeof SecretResponse>;

export const SecretListResponse = z.array(SecretResponse);

export type SecretListResponse = z.infer<typeof SecretListResponse>;
