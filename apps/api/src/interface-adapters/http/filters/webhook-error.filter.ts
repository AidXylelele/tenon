import {
  type ArgumentsHost,
  Catch,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import {
  DomainError,
  StorageUnavailableError,
} from '../../../domain/errors.js';

@Catch(DomainError)
export class WebhookErrorFilter extends BaseExceptionFilter {
  override catch(error: DomainError, host: ArgumentsHost): void {
    const answer =
      error instanceof StorageUnavailableError
        ? new ServiceUnavailableException(error.message)
        : new NotFoundException();
    super.catch(answer, host);
  }
}
