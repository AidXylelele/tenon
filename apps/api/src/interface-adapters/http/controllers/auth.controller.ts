import {
  CurrentUser,
  PasswordResetService,
  Public,
  SessionService,
  SignInService,
} from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Transactional } from '@nestjs-cls/transactional';
import { AuthenticateUser } from '../../../application/use-cases/authenticate-user.js';
import { ChangePassword } from '../../../application/use-cases/change-password.js';
import type { User } from '../../../domain/user.js';
import { ChangePasswordDto } from '../dto/change-password.dto.js';
import { CompletePasswordRecoveryDto } from '../dto/complete-password-recovery.dto.js';
import { RequestPasswordRecoveryDto } from '../dto/request-password-recovery.dto.js';
import { SessionResponse } from '../dto/responses.dto.js';
import { SignInDto } from '../dto/sign-in.dto.js';
import { UserPresenter } from '../presenters/user.presenter.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authenticateUser: AuthenticateUser,
    private readonly changePassword: ChangePassword,
    private readonly signInService: SignInService,
    private readonly sessions: SessionService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Post('session')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({ type: SessionResponse })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiTooManyRequestsResponse()
  async signIn(@Body() dto: SignInDto): Promise<SessionResponse> {
    const user = await this.authenticateUser.execute(dto);
    await this.signInService.signIn(user.id, { method: 'password' });
    return { user: UserPresenter.user(user) };
  }

  @Get('session')
  @Can.Anyone()
  @ApiCookieAuth('sessionCookie')
  @ApiOkResponse({ type: SessionResponse })
  currentSession(@CurrentUser() user: User): SessionResponse {
    return { user: UserPresenter.user(user) };
  }

  @Delete('session')
  @Can.Anyone()
  @HttpCode(204)
  @ApiCookieAuth('sessionCookie')
  @ApiNoContentResponse()
  async signOut(): Promise<void> {
    await this.signInService.signOut();
  }

  @Post('password-recovery')
  @Public()
  @HttpCode(202)
  @ApiAcceptedResponse()
  @ApiTooManyRequestsResponse()
  requestRecovery(@Body() dto: RequestPasswordRecoveryDto): void {
    this.passwordReset.request(dto.email);
  }

  @Post('password-recovery/complete')
  @Public()
  @Transactional()
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiBadRequestResponse()
  async completeRecovery(
    @Body() dto: CompletePasswordRecoveryDto,
  ): Promise<void> {
    const result = await this.passwordReset.reset(dto.token, dto.newPassword);

    if (!result) {
      throw new BadRequestException('The link is invalid or expired');
    }
  }

  @Patch('password')
  @Can.Anyone()
  @Transactional()
  @HttpCode(204)
  @ApiCookieAuth('sessionCookie')
  @ApiNoContentResponse()
  @ApiBadRequestResponse()
  async updatePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.changePassword.execute({ userId: user.id, ...dto });
    const rotated = await this.signInService.rotateSession();
    await this.sessions.revokeAll(user.id, { except: rotated?.session.id });
  }
}
