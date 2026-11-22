import {
  CurrentSession,
  CurrentUser,
  PasswordResetService,
  Public,
  type SessionRecord,
  SignInService,
} from "@nestjs/authentication";
import { Can } from "@nestjs/authorization";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
} from "@nestjs/common";
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
} from "@nestjs/swagger";
import { Transactional } from "@nestjs-cls/transactional";
import { minutes, Throttle } from "@nestjs/throttler";
import { AuthenticateUser } from "../../../application/identity/accounts/authenticate-user.js";
import { ChangePassword } from "../../../application/identity/accounts/change-password.js";
import type { User } from "../../../domain/identity/users/user.js";
import { ProblemPresenter } from "../presenters/problem.presenter.js";
import { UserPresenter } from "../presenters/user.presenter.js";
import {
  ChangePasswordBody,
  CompletePasswordRecoveryBody,
  PasswordRecoveryBody,
  SessionResponse,
  SignInBody,
} from "../schemas/auth.schema.js";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authenticateUser: AuthenticateUser,
    private readonly changePassword: ChangePassword,
    private readonly signInService: SignInService,
    private readonly passwordReset: PasswordResetService,
    private readonly userPresenter: UserPresenter,
    private readonly problemPresenter: ProblemPresenter,
  ) {}

  @Post("session")
  @Public()
  @Throttle({
    default: { limit: 30, ttl: minutes(15) },
    account: { limit: 10, ttl: minutes(15) },
  })
  @HttpCode(200)
  @ApiOkResponse({ standardSchema: SessionResponse })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiTooManyRequestsResponse()
  async signIn(
    @Body({ schema: SignInBody }) body: SignInBody,
  ): Promise<SessionResponse> {
    const authenticated = await this.authenticateUser.execute(body);

    if (!authenticated.ok)
      throw this.problemPresenter.of(authenticated.failure);

    const user = authenticated.value;
    await this.signInService.signIn(user.id, { method: "password" });
    return this.userPresenter.session(user);
  }

  @Get("session")
  @Can.Anyone()
  @ApiCookieAuth("sessionCookie")
  @ApiOkResponse({ standardSchema: SessionResponse })
  currentSession(@CurrentUser() user: User): SessionResponse {
    return this.userPresenter.session(user);
  }

  @Delete("session")
  @Can.Anyone()
  @HttpCode(204)
  @ApiCookieAuth("sessionCookie")
  @ApiNoContentResponse()
  async signOut(): Promise<void> {
    await this.signInService.signOut();
  }

  @Post("password-recovery")
  @Public()
  @Throttle({
    default: { limit: 10, ttl: minutes(15) },
    account: { limit: 3, ttl: minutes(15) },
  })
  @HttpCode(202)
  @ApiAcceptedResponse()
  @ApiTooManyRequestsResponse()
  requestRecovery(
    @Body({ schema: PasswordRecoveryBody }) body: PasswordRecoveryBody,
  ): void {
    this.passwordReset.request(body.email);
  }

  @Post("password-recovery/complete")
  @Public()
  @Transactional()
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiBadRequestResponse()
  async completeRecovery(
    @Body({ schema: CompletePasswordRecoveryBody })
    body: CompletePasswordRecoveryBody,
  ): Promise<void> {
    const result = await this.passwordReset.reset(body.token, body.newPassword);

    if (!result) {
      throw new BadRequestException("The link is invalid or expired");
    }
  }

  @Patch("password")
  @Can.Anyone()
  @HttpCode(204)
  @ApiCookieAuth("sessionCookie")
  @ApiNoContentResponse()
  @ApiBadRequestResponse()
  async updatePassword(
    @Body({ schema: ChangePasswordBody }) body: ChangePasswordBody,
    @CurrentUser() user: User,
    @CurrentSession() session: SessionRecord | null,
  ): Promise<void> {
    const sessionId = session?.id ?? null;
    const changed = await this.changePassword.execute({
      userId: user.id,
      sessionId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });

    if (!changed.ok) throw this.problemPresenter.of(changed.failure);

    await this.signInService.rotateSession();
  }
}
