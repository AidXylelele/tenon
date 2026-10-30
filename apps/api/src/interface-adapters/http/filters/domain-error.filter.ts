import { STATUS_CODES } from 'node:http';
import {
  type ArgumentsHost,
  Catch,
  ConflictException,
  ForbiddenException,
  GoneException,
  type HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
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
      const statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
      const reason = STATUS_CODES[statusCode];
      return new UnprocessableEntityException({
        statusCode,
        error: reason,
        message: error.message,
        pointer: error.pointer,
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
