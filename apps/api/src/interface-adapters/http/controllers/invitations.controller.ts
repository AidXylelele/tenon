import { CurrentUser, Public, SignInService } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiGoneResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Transactional } from '@nestjs-cls/transactional';
import { z } from 'zod';
import { InvitationPolicy } from '../../../application/identity/invitation.policy.js';
import { AcceptInvitation } from '../../../application/identity/accept-invitation.js';
import { InviteUser } from '../../../application/identity/invite-user.js';
import { InvitationQueries } from '../../../application/identity/queries.js';
import { RevokeInvitation } from '../../../application/identity/revoke-invitation.js';
import { VerifyInvitationLink } from '../../../application/identity/verify-invitation-link.js';
import type { User } from '../../../domain/identity/user.js';
import { InvitationPresenter } from '../presenters/invitation.presenter.js';
import {
  AcceptedInvitationResponse,
  AcceptInvitationBody,
  CreateInvitationBody,
  InvitationResponse,
  InvitationTokenBody,
  VerifiedInvitationResponse,
} from '../schemas/invitation.schemas.js';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly inviteUser: InviteUser,
    private readonly invitations: InvitationQueries,
    private readonly revokeInvitation: RevokeInvitation,
    private readonly verifyInvitationLink: VerifyInvitationLink,
    private readonly acceptInvitation: AcceptInvitation,
    private readonly signInService: SignInService,
  ) {}

  @Post()
  @Can(InvitationPolicy, 'manage')
  @HttpCode(201)
  @ApiCookieAuth('sessionCookie')
  @ApiCreatedResponse({ standardSchema: InvitationResponse })
  @ApiConflictResponse()
  async create(
    @Body({ schema: CreateInvitationBody }) body: CreateInvitationBody,
    @CurrentUser() user: User,
  ): Promise<InvitationResponse> {
    const invitation = await this.inviteUser.execute({
      email: body.email,
      role: body.role,
      invitedBy: user.id,
      inviterName: user.name,
    });
    return InvitationPresenter.created(invitation);
  }

  @Get()
  @Can(InvitationPolicy, 'manage')
  @ApiCookieAuth('sessionCookie')
  @ApiOkResponse({ standardSchema: z.array(InvitationResponse) })
  async list(): Promise<InvitationResponse[]> {
    const pending = await this.invitations.listPending();
    return pending.map((invitation) => InvitationPresenter.pending(invitation));
  }

  @Delete(':id')
  @Can(InvitationPolicy, 'manage')
  @HttpCode(204)
  @ApiCookieAuth('sessionCookie')
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiGoneResponse()
  revoke(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.revokeInvitation.execute(id);
  }

  @Post('verify')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({ standardSchema: VerifiedInvitationResponse })
  @ApiNotFoundResponse()
  @ApiGoneResponse()
  async verify(
    @Body({ schema: InvitationTokenBody }) body: InvitationTokenBody,
  ): Promise<VerifiedInvitationResponse> {
    const invitation = await this.verifyInvitationLink.execute(body.token);
    return InvitationPresenter.verified(invitation);
  }

  @Post('accept')
  @Public()
  @Transactional()
  @HttpCode(200)
  @ApiOkResponse({ standardSchema: AcceptedInvitationResponse })
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiGoneResponse()
  async accept(
    @Body({ schema: AcceptInvitationBody }) body: AcceptInvitationBody,
  ): Promise<AcceptedInvitationResponse> {
    await this.signInService.signOut();
    const accepted = await this.acceptInvitation.execute(body);
    await this.signInService.signIn(accepted.user.id, { method: 'invitation' });
    return InvitationPresenter.accepted(accepted);
  }
}
