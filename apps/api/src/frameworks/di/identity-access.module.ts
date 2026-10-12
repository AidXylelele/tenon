import {
  AuthenticationModule,
  PasswordHasher as ScryptPasswordHasher,
} from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccountRepository,
  InvitationQueries,
  InvitationRepository,
  Mailing,
  PasswordHasher,
  UserRepository,
} from '../../application/interfaces.js';
import { InvitationPolicy } from '../../application/policies/invitation.policy.js';
import { AuthenticateUser } from '../../application/use-cases/authenticate-user.js';
import { AcceptInvitation } from '../../application/use-cases/accept-invitation.js';
import { ChangePassword } from '../../application/use-cases/change-password.js';
import { InviteUser } from '../../application/use-cases/invite-user.js';
import { ListPendingInvitations } from '../../application/use-cases/list-pending-invitations.js';
import { ResetPassword } from '../../application/use-cases/reset-password.js';
import { RevokeInvitation } from '../../application/use-cases/revoke-invitation.js';
import { VerifyInvitationLink } from '../../application/use-cases/verify-invitation-link.js';
import { PasswordRecoveryHandler } from '../../interface-adapters/auth/password-recovery.handler.js';
import { SessionAuthenticationProvider } from '../../interface-adapters/auth/session-authentication.provider.js';
import { DrizzleEmailTokenStore } from '../../interface-adapters/auth/stores/drizzle-email-token.store.js';
import { DrizzleSessionStore } from '../../interface-adapters/auth/stores/drizzle-session.store.js';
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
    AuthorizationModule.forRoot({ policies: [InvitationPolicy] }),
  ],
  controllers: [AuthController, InvitationsController],
  providers: [
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
    SessionAuthenticationProvider,
    PasswordRecoveryHandler,
    {
      provide: AuthenticateUser,
      inject: [AccountRepository, UserRepository, PasswordHasher],
      useFactory: (
        accounts: AccountRepository,
        users: UserRepository,
        passwords: PasswordHasher,
      ) => new AuthenticateUser(accounts, users, passwords),
    },
    {
      provide: ChangePassword,
      inject: [AccountRepository, PasswordHasher],
      useFactory: (accounts: AccountRepository, passwords: PasswordHasher) =>
        new ChangePassword(accounts, passwords),
    },
    {
      provide: ResetPassword,
      inject: [AccountRepository, UserRepository],
      useFactory: (accounts: AccountRepository, users: UserRepository) =>
        new ResetPassword(accounts, users),
    },
    {
      provide: InviteUser,
      inject: [InvitationRepository, UserRepository, Mailing],
      useFactory: (
        invitations: InvitationRepository,
        users: UserRepository,
        mailing: Mailing,
      ) => new InviteUser(invitations, users, mailing),
    },
    {
      provide: ListPendingInvitations,
      inject: [InvitationQueries],
      useFactory: (invitations: InvitationQueries) =>
        new ListPendingInvitations(invitations),
    },
    {
      provide: RevokeInvitation,
      inject: [InvitationRepository],
      useFactory: (invitations: InvitationRepository) =>
        new RevokeInvitation(invitations),
    },
    {
      provide: VerifyInvitationLink,
      inject: [InvitationRepository],
      useFactory: (invitations: InvitationRepository) =>
        new VerifyInvitationLink(invitations),
    },
    {
      provide: AcceptInvitation,
      inject: [
        InvitationRepository,
        UserRepository,
        AccountRepository,
        PasswordHasher,
      ],
      useFactory: (
        invitations: InvitationRepository,
        users: UserRepository,
        accounts: AccountRepository,
        passwords: PasswordHasher,
      ) => new AcceptInvitation(invitations, users, accounts, passwords),
    },
  ],
})
export class IdentityAccessModule {}
