import { z } from 'zod';
import { Role } from '../../../domain/identity/enums.js';

export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email())
  .meta({ format: 'email' });

export const NewPassword = z.string().min(12).max(128);

export const SignInBody = z.strictObject({
  email: Email,
  password: z.string().max(128),
});

export type SignInBody = z.infer<typeof SignInBody>;

export const PasswordRecoveryBody = z.strictObject({ email: Email });

export type PasswordRecoveryBody = z.infer<typeof PasswordRecoveryBody>;

export const CompletePasswordRecoveryBody = z.strictObject({
  token: z.string().min(32),
  newPassword: NewPassword,
});

export type CompletePasswordRecoveryBody = z.infer<
  typeof CompletePasswordRecoveryBody
>;

export const ChangePasswordBody = z.strictObject({
  currentPassword: z.string().max(128),
  newPassword: NewPassword,
});

export type ChangePasswordBody = z.infer<typeof ChangePasswordBody>;

export const UserResponse = z.object({
  id: z.uuid(),
  email: Email,
  name: z.string(),
  role: z.enum(Role),
});

export type UserResponse = z.infer<typeof UserResponse>;

export const SessionResponse = z.object({ user: UserResponse });

export type SessionResponse = z.infer<typeof SessionResponse>;
