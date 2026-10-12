import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ForbiddenException,
  GoneException,
  type HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import {
  AccountConflictError,
  AccountExistsError,
  DomainError,
  InvalidCredentialsError,
  InvalidPasswordError,
  InvitationConflictError,
  InvitationExpiredError,
  InvitationNotFoundError,
  InvitationRevokedError,
  InvitationUsedError,
  UserNotFoundError,
  UserSuspendedError,
} from '../../../domain/errors.js';

@Catch(DomainError)
export class DomainErrorFilter extends BaseExceptionFilter {
  override catch(error: DomainError, host: ArgumentsHost): void {
    super.catch(this.toHttpException(error) ?? error, host);
  }

  private toHttpException(error: DomainError): HttpException | undefined {
    if (error instanceof InvalidCredentialsError) {
      return new UnauthorizedException(error.message);
    }

    if (error instanceof UserSuspendedError) {
      return new ForbiddenException(error.message);
    }

    if (error instanceof InvalidPasswordError) {
      return new BadRequestException(error.message);
    }

    if (
      error instanceof InvitationNotFoundError ||
      error instanceof UserNotFoundError
    ) {
      return new NotFoundException(error.message);
    }

    if (
      error instanceof AccountExistsError ||
      error instanceof AccountConflictError ||
      error instanceof InvitationConflictError
    ) {
      return new ConflictException(error.message);
    }

    if (
      error instanceof InvitationUsedError ||
      error instanceof InvitationRevokedError ||
      error instanceof InvitationExpiredError
    ) {
      return new GoneException(error.message);
    }

    return undefined;
  }
}
