import { z } from 'zod';
import { InvitationStatus, Role } from '../../../domain/identity/enums.js';
import { Email, NewPassword, UserResponse } from './auth.schemas.js';

export const CreateInvitationBody = z.strictObject({
  email: Email,
  role: z.enum(Role),
});

export type CreateInvitationBody = z.infer<typeof CreateInvitationBody>;

export const InvitationTokenBody = z.strictObject({
  token: z.string().min(32),
});

export type InvitationTokenBody = z.infer<typeof InvitationTokenBody>;

export const AcceptInvitationBody = z.strictObject({
  token: z.string().min(32),
  name: z.string().trim().min(1).max(120),
  password: NewPassword,
});

export type AcceptInvitationBody = z.infer<typeof AcceptInvitationBody>;

export const InvitationResponse = z.object({
  id: z.uuid(),
  email: Email,
  role: z.enum(Role),
  status: z.enum(InvitationStatus),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export type InvitationResponse = z.infer<typeof InvitationResponse>;

export const VerifiedInvitationResponse = z.object({
  email: Email,
  role: z.enum(Role),
  expiresAt: z.iso.datetime(),
});

export type VerifiedInvitationResponse = z.infer<
  typeof VerifiedInvitationResponse
>;

export const AcceptedInvitationResponse = z.object({ user: UserResponse });

export type AcceptedInvitationResponse = z.infer<
  typeof AcceptedInvitationResponse
>;
