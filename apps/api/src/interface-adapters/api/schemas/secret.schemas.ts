import { z } from "zod";

export const SecretName = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/);

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

export const SecretResponse = z.object({
  name: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type SecretResponse = z.infer<typeof SecretResponse>;

const SecretUseResponse = z.object({
  namespace: z.string(),
  name: z.string(),
  version: z.string(),
});

const ListedSecretResponse = SecretResponse.extend({
  usedBy: z.array(SecretUseResponse),
});

export const SecretListResponse = z.array(ListedSecretResponse);

export type SecretListResponse = z.infer<typeof SecretListResponse>;
