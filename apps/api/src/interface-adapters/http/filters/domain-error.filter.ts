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
  AccountExistsError,
  DomainError,
  InvalidCredentialsError,
  InvalidPasswordError,
  InvitationConflictError,
  InvitationNotFoundError,
  UserNotFoundError,
  UserSuspendedError,
} from '../../../domain/errors.js';

@Catch(DomainError)
export class DomainErrorFilter extends BaseExceptionFilter {
  override catch(error: DomainError, host: ArgumentsHost): void {
    super.catch(this.toHttpException(error), host);
  }

  private toHttpException(error: DomainError): HttpException {
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
      error instanceof InvitationConflictError
    ) {
      return new ConflictException(error.message);
    }

    return new GoneException(error.message);
  }
}
