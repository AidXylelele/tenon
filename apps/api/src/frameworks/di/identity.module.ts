import {
  AuthenticationModule,
  PasswordHasher as ScryptPasswordHasher,
} from '@nestjs/authentication';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccountRepository,
  InvitationRepository,
  PasswordHasher,
  Sessions,
  UserRepository,
} from '../../application/identity/ports.js';
import { InvitationPolicy } from '../../application/identity/invitation.policy.js';
import { InvitationQueries } from '../../application/identity/queries.js';
import { AuthenticateUser } from '../../application/identity/authenticate-user.js';
import { AcceptInvitation } from '../../application/identity/accept-invitation.js';
import { ChangePassword } from '../../application/identity/change-password.js';
import { FindRecoveryAccount } from '../../application/identity/find-recovery-account.js';
import { ResolveSessionUser } from '../../application/identity/resolve-session-user.js';
import { SendRecoveryLink } from '../../application/identity/send-recovery-link.js';
import { InviteUser } from '../../application/identity/invite-user.js';
import { ResetPassword } from '../../application/identity/reset-password.js';
import { RevokeInvitation } from '../../application/identity/revoke-invitation.js';
import { VerifyInvitationLink } from '../../application/identity/verify-invitation-link.js';
import { PasswordRecoveryHandler } from '../../interface-adapters/http/auth/password-recovery.handler.js';
import { SessionAuthenticationProvider } from '../../interface-adapters/http/auth/session-authentication.provider.js';
import { SessionsGateway } from '../../interface-adapters/http/auth/sessions.gateway.js';
import { DrizzleEmailTokenStore } from '../../interface-adapters/persistence/stores/drizzle-email-token.store.js';
import { DrizzleSessionStore } from '../../interface-adapters/persistence/stores/drizzle-session.store.js';
import { AuthController } from '../../interface-adapters/http/controllers/auth.controller.js';
import { InvitationsController } from '../../interface-adapters/http/controllers/invitations.controller.js';
import { DrizzleAccountRepository } from '../../interface-adapters/persistence/repositories/drizzle-account.repository.js';
import { DrizzleInvitationQueries } from '../../interface-adapters/persistence/queries/drizzle-invitation.queries.js';
import { DrizzleInvitationRepository } from '../../interface-adapters/persistence/repositories/drizzle-invitation.repository.js';
import { DrizzleUserRepository } from '../../interface-adapters/persistence/repositories/drizzle-user.repository.js';
import type { Env } from './config.module.js';
import { MailModule } from './mail.module.js';

@Module({
  imports: [
    MailModule,
    AuthenticationModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        session: {
          absoluteTtl: '30d',
          idleTtl: '7d',
          cookie: {
            secure: config.get('SESSION_COOKIE_SECURE', { infer: true }),
            sameSite: 'lax',
          },
          trustedOrigins: config.get('TRUSTED_ORIGINS', { infer: true }),
          metadata: (request) => ({
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          }),
        },
        passwordReset: {
          url: `${config.get('WEB_BASE_URL', { infer: true })}/reset-password`,
          ttl: '1h',
        },
      }),
    }),
  ],
  controllers: [AuthController, InvitationsController],
  providers: [
    InvitationPolicy,
    DrizzleSessionStore,
    DrizzleEmailTokenStore,
    DrizzleUserRepository,
    { provide: UserRepository, useExisting: DrizzleUserRepository },
    DrizzleAccountRepository,
    { provide: AccountRepository, useExisting: DrizzleAccountRepository },
    DrizzleInvitationRepository,
    { provide: InvitationRepository, useExisting: DrizzleInvitationRepository },
    DrizzleInvitationQueries,
    { provide: InvitationQueries, useExisting: DrizzleInvitationQueries },
    { provide: PasswordHasher, useExisting: ScryptPasswordHasher },
    SessionsGateway,
    { provide: Sessions, useExisting: SessionsGateway },
    SessionAuthenticationProvider,
    PasswordRecoveryHandler,
    AuthenticateUser,
    ResolveSessionUser,
    FindRecoveryAccount,
    SendRecoveryLink,
    ChangePassword,
    ResetPassword,
    InviteUser,
    RevokeInvitation,
    VerifyInvitationLink,
    AcceptInvitation,
  ],
  exports: [UserRepository],
})
export class IdentityModule {}
