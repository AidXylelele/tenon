import { AutomationPolicy } from "../../interface-adapters/api/auth/automation.policy.js";
import { PasswordHasher as ScryptPasswordHasher } from "@nestjs/authentication";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AccountRepository,
  InvitationRepository,
  PasswordHasher,
  Sessions,
  UserRepository,
} from "../../application/identity/ports.js";
import { InvitationPolicy } from "../../interface-adapters/api/auth/invitation.policy.js";
import { InvitationQueries } from "../../application/identity/queries.js";
import { AuthenticateUser } from "../../application/identity/authenticate-user.js";
import { AcceptInvitation } from "../../application/identity/accept-invitation.js";
import { SeedAdministrator } from "../../application/identity/seed-administrator.js";
import { ChangePassword } from "../../application/identity/change-password.js";
import { FindRecoveryAccount } from "../../application/identity/find-recovery-account.js";
import { ResolveSessionUser } from "../../application/identity/resolve-session-user.js";
import { SendRecoveryLink } from "../../application/identity/send-recovery-link.js";
import { InviteUser } from "../../application/identity/invite-user.js";
import { ResetPassword } from "../../application/identity/reset-password.js";
import { RevokeInvitation } from "../../application/identity/revoke-invitation.js";
import { VerifyInvitationLink } from "../../application/identity/verify-invitation-link.js";
import { PasswordRecoveryHandler } from "../../interface-adapters/api/auth/password-recovery.handler.js";
import { SessionAuthenticationProvider } from "../../interface-adapters/api/auth/session-authentication.provider.js";
import { SessionsGateway } from "../../interface-adapters/api/auth/sessions.gateway.js";
import { PostgresEmailTokenStore } from "../../interface-adapters/persistence/stores/postgres-email-token.store.js";
import { PostgresSessionStore } from "../../interface-adapters/persistence/stores/postgres-session.store.js";
import { AuthController } from "../../interface-adapters/api/controllers/auth.controller.js";
import { InvitationsController } from "../../interface-adapters/api/controllers/invitations.controller.js";
import { AccountMapper } from "../../interface-adapters/persistence/mappers/account.mapper.js";
import { InvitationMapper } from "../../interface-adapters/persistence/mappers/invitation.mapper.js";
import { UserMapper } from "../../interface-adapters/persistence/mappers/user.mapper.js";
import { PostgresAccountRepository } from "../../interface-adapters/persistence/repositories/postgres-account.repository.js";
import { PostgresInvitationQueries } from "../../interface-adapters/persistence/queries/postgres-invitation.queries.js";
import { PostgresInvitationRepository } from "../../interface-adapters/persistence/repositories/postgres-invitation.repository.js";
import { PostgresUserRepository } from "../../interface-adapters/persistence/repositories/postgres-user.repository.js";
import type { Env } from "./env.schema.js";
import { Mailing } from "../../application/identity/ports.js";
import { MailOutboxHandler } from "../outbox/mail.outbox.handler.js";
import { IdentityJobs } from "../schedule/identity.jobs.js";
import { MailGateway } from "../../interface-adapters/mailing/mail.gateway.js";
import { InvitationMail } from "../../interface-adapters/mailing/templates/invitation.mail.js";
import { PasswordResetMail } from "../../interface-adapters/mailing/templates/password-reset.mail.js";
import { InvitationPresenter } from "../../interface-adapters/api/presenters/invitation.presenter.js";
import { ProblemPresenter } from "../../interface-adapters/api/presenters/problem.presenter.js";
import { UserPresenter } from "../../interface-adapters/api/presenters/user.presenter.js";

@Module({
  controllers: [AuthController, InvitationsController],
  providers: [
    AutomationPolicy,
    InvitationPolicy,
    PostgresSessionStore,
    PostgresEmailTokenStore,
    UserMapper,
    AccountMapper,
    InvitationMapper,
    { provide: UserRepository, useClass: PostgresUserRepository },
    { provide: AccountRepository, useClass: PostgresAccountRepository },
    { provide: InvitationRepository, useClass: PostgresInvitationRepository },
    { provide: InvitationQueries, useClass: PostgresInvitationQueries },
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
    SeedAdministrator,
    IdentityJobs,
    {
      provide: InvitationMail,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new InvitationMail(config.get("WEB_BASE_URL", { infer: true })),
    },
    PasswordResetMail,
    MailGateway,
    { provide: Mailing, useExisting: MailGateway },
    MailOutboxHandler,
    ProblemPresenter,
    UserPresenter,
    InvitationPresenter,
  ],
  exports: [
    AutomationPolicy,
    InvitationPolicy,
    PostgresSessionStore,
    PostgresEmailTokenStore,
  ],
})
export class IdentityModule {}
