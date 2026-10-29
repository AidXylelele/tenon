import {
  type ArgumentsHost,
  Catch,
  ConflictException,
  ForbiddenException,
  GoneException,
  type HttpException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { WorkflowPresenter } from '../presenters/workflow.presenter.js';
import {
  AuthenticationError,
  ConflictError,
  DefinitionRejectedError,
  DomainError,
  ExpiredError,
  ForbiddenError,
  NotFoundError,
  RuleViolationError,
} from '../../../domain/errors.js';

@Catch(DomainError)
export class DomainErrorFilter extends BaseExceptionFilter {
  override catch(error: DomainError, host: ArgumentsHost): void {
    const exception = this.#httpExceptionOf(error) ?? error;
    super.catch(exception, host);
  }

  #httpExceptionOf(error: DomainError): HttpException | undefined {
    if (error instanceof NotFoundError) {
      return new NotFoundException(error.message);
    }

    if (error instanceof ConflictError) {
      return new ConflictException(error.message);
    }

    if (error instanceof DefinitionRejectedError) {
      const problems = WorkflowPresenter.problems(error.problems);
      return new UnprocessableEntityException({
        statusCode: 422,
        message: error.message,
        problems,
      });
    }

    if (error instanceof RuleViolationError) {
      return new UnprocessableEntityException(error.message);
    }

    if (error instanceof ExpiredError) {
      return new GoneException(error.message);
    }

    if (error instanceof AuthenticationError) {
      return new UnauthorizedException(error.message);
    }

    if (error instanceof ForbiddenError) {
      return new ForbiddenException(error.message);
    }

    return undefined;
  }
}
