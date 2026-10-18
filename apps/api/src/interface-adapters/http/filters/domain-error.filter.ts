import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ForbiddenException,
  GoneException,
  type HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
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
  InvalidGraphError,
  InvalidOwnerError,
  NodeConfigurationError,
  NodeNotFoundError,
  NotATriggerError,
  ReleaseConflictError,
  ReleaseNotFoundError,
  ReleaseWithoutTriggerError,
  RunConflictError,
  RunFinishedError,
  RunNotFoundError,
  StorageUnavailableError,
  UserNotFoundError,
  UserSuspendedError,
  WebhookEndpointConflictError,
  WebhookEndpointNotFoundError,
  WorkflowAccessDeniedError,
  WorkflowArchivedError,
  WorkflowConflictError,
  WorkflowInactiveError,
  WorkflowNotArchivedError,
  WorkflowNotFoundError,
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

    if (
      error instanceof UserSuspendedError ||
      error instanceof WorkflowAccessDeniedError
    ) {
      return new ForbiddenException(error.message);
    }

    if (error instanceof InvalidPasswordError) {
      return new BadRequestException(error.message);
    }

    if (
      error instanceof InvitationNotFoundError ||
      error instanceof UserNotFoundError ||
      error instanceof WorkflowNotFoundError ||
      error instanceof ReleaseNotFoundError ||
      error instanceof RunNotFoundError ||
      error instanceof NodeNotFoundError ||
      error instanceof WebhookEndpointNotFoundError
    ) {
      return new NotFoundException(error.message);
    }

    if (
      error instanceof AccountExistsError ||
      error instanceof AccountConflictError ||
      error instanceof InvitationConflictError ||
      error instanceof WorkflowConflictError ||
      error instanceof ReleaseConflictError ||
      error instanceof RunConflictError ||
      error instanceof WebhookEndpointConflictError ||
      error instanceof WorkflowArchivedError ||
      error instanceof WorkflowNotArchivedError ||
      error instanceof WorkflowInactiveError ||
      error instanceof RunFinishedError
    ) {
      return new ConflictException(error.message);
    }

    if (error instanceof InvalidGraphError) {
      return new UnprocessableEntityException({
        statusCode: 422,
        message: error.message,
        error: 'Unprocessable Entity',
        faults: error.faults,
      });
    }

    if (error instanceof NodeConfigurationError) {
      return new UnprocessableEntityException({
        statusCode: 422,
        message: error.message,
        error: 'Unprocessable Entity',
        problems: error.problems,
      });
    }

    if (
      error instanceof NotATriggerError ||
      error instanceof ReleaseWithoutTriggerError ||
      error instanceof InvalidOwnerError
    ) {
      return new UnprocessableEntityException(error.message);
    }

    if (error instanceof StorageUnavailableError) {
      return new ServiceUnavailableException(error.message);
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
