import { PasswordHasher as ScryptPasswordHasher } from "@nestjs/authentication";
import { Module } from "@nestjs/common";
import { AcceptInvitation } from "../../application/identity/accept-invitation.js";
import { AuthenticateUser } from "../../application/identity/authenticate-user.js";
import { ChangePassword } from "../../application/identity/change-password.js";
import { FindRecoveryAccount } from "../../application/identity/find-recovery-account.js";
import { InviteUser } from "../../application/identity/invite-user.js";
import {
  AccountRepository,
  InvitationRepository,
  Mailing,
  PasswordHasher,
  Sessions,
  UserRepository,
} from "../../application/identity/ports.js";
import { InvitationQueries } from "../../application/identity/queries.js";
import { ResetPassword } from "../../application/identity/reset-password.js";
import { ResolveSessionUser } from "../../application/identity/resolve-session-user.js";
import { RevokeInvitation } from "../../application/identity/revoke-invitation.js";
import { SendRecoveryLink } from "../../application/identity/send-recovery-link.js";
import { VerifyInvitationLink } from "../../application/identity/verify-invitation-link.js";
import { InvitationPolicy } from "../../interface-adapters/api/auth/invitation.policy.js";
import { PasswordRecoveryHandler } from "../../interface-adapters/api/auth/password-recovery.handler.js";
import { SessionAuthenticationProvider } from "../../interface-adapters/api/auth/session-authentication.provider.js";
import { SessionsGateway } from "../../interface-adapters/api/auth/sessions.gateway.js";
import { AuthController } from "../../interface-adapters/api/controllers/auth.controller.js";
import { InvitationsController } from "../../interface-adapters/api/controllers/invitations.controller.js";
import { InvitationPresenter } from "../../interface-adapters/api/presenters/invitation.presenter.js";
import { UserPresenter } from "../../interface-adapters/api/presenters/user.presenter.js";
import { MailGateway } from "../../interface-adapters/mailing/mail.gateway.js";
import { AccountMapper } from "../../interface-adapters/persistence/mappers/account.mapper.js";
import { InvitationMapper } from "../../interface-adapters/persistence/mappers/invitation.mapper.js";
import { UserMapper } from "../../interface-adapters/persistence/mappers/user.mapper.js";
import { PostgresInvitationQueries } from "../../interface-adapters/persistence/queries/postgres-invitation.queries.js";
import { PostgresAccountRepository } from "../../interface-adapters/persistence/repositories/postgres-account.repository.js";
import { PostgresInvitationRepository } from "../../interface-adapters/persistence/repositories/postgres-invitation.repository.js";
import { PostgresUserRepository } from "../../interface-adapters/persistence/repositories/postgres-user.repository.js";
import { PostgresEmailTokenStore } from "../../interface-adapters/persistence/stores/postgres-email-token.store.js";
import { PostgresSessionStore } from "../../interface-adapters/persistence/stores/postgres-session.store.js";
import { HttpModule } from "./http.module.js";

@Module({
  imports: [HttpModule],
  controllers: [AuthController, InvitationsController],
  providers: [
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
    InvitationPolicy,
    SessionAuthenticationProvider,
    PasswordRecoveryHandler,
    SessionsGateway,
    { provide: Sessions, useExisting: SessionsGateway },
    MailGateway,
    { provide: Mailing, useExisting: MailGateway },
    UserMapper,
    AccountMapper,
    InvitationMapper,
    { provide: UserRepository, useClass: PostgresUserRepository },
    { provide: AccountRepository, useClass: PostgresAccountRepository },
    { provide: InvitationRepository, useClass: PostgresInvitationRepository },
    { provide: InvitationQueries, useClass: PostgresInvitationQueries },
    PostgresSessionStore,
    PostgresEmailTokenStore,
    UserPresenter,
    InvitationPresenter,
    { provide: PasswordHasher, useExisting: ScryptPasswordHasher },
  ],
})
export class IdentityHttpModule {}
