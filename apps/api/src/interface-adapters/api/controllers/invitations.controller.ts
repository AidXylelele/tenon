import { CurrentUser, Public, SignInService } from "@nestjs/authentication";
import { Can } from "@nestjs/authorization";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiGoneResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from "@nestjs/swagger";
import { minutes, Throttle } from "@nestjs/throttler";
import { InvitationPolicy } from "../auth/invitation.policy.js";
import { AcceptInvitation } from "../../../application/identity/invitations/accept-invitation.js";
import { InviteUser } from "../../../application/identity/invitations/invite-user.js";
import { InvitationQueries } from "../../../application/identity/invitations/queries.js";
import { RevokeInvitation } from "../../../application/identity/invitations/revoke-invitation.js";
import { VerifyInvitationLink } from "../../../application/identity/invitations/verify-invitation-link.js";
import type { User } from "../../../domain/identity/users/user.js";
import { InvitationPresenter } from "../presenters/invitation.presenter.js";
import { ProblemPresenter } from "../presenters/problem.presenter.js";
import {
  AcceptedInvitationResponse,
  AcceptInvitationBody,
  CreateInvitationBody,
  InvitationListResponse,
  InvitationResponse,
  InvitationTokenBody,
  VerifiedInvitationResponse,
} from "../schemas/invitation.schema.js";

@ApiTags("invitations")
@Controller("invitations")
export class InvitationsController {
  constructor(
    private readonly inviteUser: InviteUser,
    private readonly invitations: InvitationQueries,
    private readonly revokeInvitation: RevokeInvitation,
    private readonly verifyInvitationLink: VerifyInvitationLink,
    private readonly acceptInvitation: AcceptInvitation,
    private readonly signInService: SignInService,
    private readonly invitationPresenter: InvitationPresenter,
    private readonly problemPresenter: ProblemPresenter,
  ) {}

  @Post()
  @Can(InvitationPolicy, "manage")
  @HttpCode(201)
  @ApiCookieAuth("sessionCookie")
  @ApiCreatedResponse({ standardSchema: InvitationResponse })
  @ApiConflictResponse()
  async create(
    @Body({ schema: CreateInvitationBody }) body: CreateInvitationBody,
    @CurrentUser() user: User,
  ): Promise<InvitationResponse> {
    const invited = await this.inviteUser.execute({
      email: body.email,
      role: body.role,
      invitedBy: user.id,
      inviterName: user.name,
    });

    if (!invited.ok) throw this.problemPresenter.of(invited.failure);

    return this.invitationPresenter.created(invited.value);
  }

  @Get()
  @Can(InvitationPolicy, "manage")
  @ApiCookieAuth("sessionCookie")
  @ApiOkResponse({ standardSchema: InvitationListResponse })
  async list(): Promise<InvitationListResponse> {
    const listed = await this.invitations.list();
    return this.invitationPresenter.list(listed);
  }

  @Delete(":id")
  @Can(InvitationPolicy, "manage")
  @HttpCode(204)
  @ApiCookieAuth("sessionCookie")
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiGoneResponse()
  async revoke(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    const revoked = await this.revokeInvitation.execute(id);

    if (!revoked.ok) throw this.problemPresenter.of(revoked.failure);
  }

  @Post("verify")
  @Public()
  @HttpCode(200)
  @ApiOkResponse({ standardSchema: VerifiedInvitationResponse })
  @ApiNotFoundResponse()
  @ApiGoneResponse()
  async verify(
    @Body({ schema: InvitationTokenBody }) body: InvitationTokenBody,
  ): Promise<VerifiedInvitationResponse> {
    const verified = await this.verifyInvitationLink.execute(body.token);

    if (!verified.ok) throw this.problemPresenter.of(verified.failure);

    return this.invitationPresenter.verified(verified.value);
  }

  @Post("accept")
  @Public()
  @Throttle({ default: { limit: 10, ttl: minutes(15) } })
  @HttpCode(200)
  @ApiOkResponse({ standardSchema: AcceptedInvitationResponse })
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiGoneResponse()
  @ApiTooManyRequestsResponse()
  async accept(
    @Body({ schema: AcceptInvitationBody }) body: AcceptInvitationBody,
  ): Promise<AcceptedInvitationResponse> {
    await this.signInService.signOut();
    const accepted = await this.acceptInvitation.execute(body);

    if (!accepted.ok) throw this.problemPresenter.of(accepted.failure);

    const user = accepted.value;
    await this.signInService.signIn(user.id, { method: "invitation" });
    return this.invitationPresenter.accepted(user);
  }
}
