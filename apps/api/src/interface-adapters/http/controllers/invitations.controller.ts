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
import { InvitationPolicy } from '../../../application/policies/invitation.policy.js';
import { AcceptInvitation } from '../../../application/use-cases/accept-invitation.js';
import { InviteUser } from '../../../application/use-cases/invite-user.js';
import { ListPendingInvitations } from '../../../application/use-cases/list-pending-invitations.js';
import { RevokeInvitation } from '../../../application/use-cases/revoke-invitation.js';
import { VerifyInvitationLink } from '../../../application/use-cases/verify-invitation-link.js';
import type { User } from '../../../domain/user.js';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto.js';
import { CreateInvitationDto } from '../dto/create-invitation.dto.js';
import {
  AcceptedInvitationResponse,
  InvitationResponse,
  VerifiedInvitationResponse,
} from '../dto/responses.dto.js';
import { VerifyInvitationDto } from '../dto/verify-invitation.dto.js';
import { InvitationPresenter } from '../presenters/invitation.presenter.js';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly inviteUser: InviteUser,
    private readonly listPendingInvitations: ListPendingInvitations,
    private readonly revokeInvitation: RevokeInvitation,
    private readonly verifyInvitationLink: VerifyInvitationLink,
    private readonly acceptInvitation: AcceptInvitation,
    private readonly signInService: SignInService,
  ) {}

  @Post()
  @Can(InvitationPolicy, 'manage')
  @Transactional()
  @HttpCode(201)
  @ApiCookieAuth('sessionCookie')
  @ApiCreatedResponse({ type: InvitationResponse })
  @ApiConflictResponse()
  async create(
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: User,
  ): Promise<InvitationResponse> {
    const invitation = await this.inviteUser.execute({
      email: dto.email,
      role: dto.role,
      invitedBy: user.id,
      inviterName: user.name,
    });
    return InvitationPresenter.created(invitation);
  }

  @Get()
  @Can(InvitationPolicy, 'manage')
  @ApiCookieAuth('sessionCookie')
  @ApiOkResponse({ type: [InvitationResponse] })
  async list(): Promise<InvitationResponse[]> {
    const pending = await this.listPendingInvitations.execute();
    return pending.map((invitation) => InvitationPresenter.pending(invitation));
  }

  @Delete(':id')
  @Can(InvitationPolicy, 'manage')
  @Transactional()
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
  @ApiOkResponse({ type: VerifiedInvitationResponse })
  @ApiNotFoundResponse()
  @ApiGoneResponse()
  async verify(
    @Body() dto: VerifyInvitationDto,
  ): Promise<VerifiedInvitationResponse> {
    const invitation = await this.verifyInvitationLink.execute(dto.token);
    return InvitationPresenter.verified(invitation);
  }

  @Post('accept')
  @Public()
  @Transactional()
  @HttpCode(200)
  @ApiOkResponse({ type: AcceptedInvitationResponse })
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiGoneResponse()
  async accept(
    @Body() dto: AcceptInvitationDto,
  ): Promise<AcceptedInvitationResponse> {
    await this.signInService.signOut();
    const accepted = await this.acceptInvitation.execute(dto);
    await this.signInService.signIn(accepted.user.id, { method: 'invitation' });
    return InvitationPresenter.accepted(accepted);
  }
}
