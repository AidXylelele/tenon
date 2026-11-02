import {
  type ArgumentsHost,
  Catch,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response } from 'express';
import { PostgresTransientFailures } from '../drizzle/postgres-transient-failures.js';

// A database that is down, failing over or out of connections is a temporary inability, which
// clients and proxies retry (RFC 9110: 503 with Retry-After). Anything else is Nest's to answer.
@Catch()
export class DatabaseUnavailableFilter extends BaseExceptionFilter {
  private static readonly RETRY_AFTER_SECONDS = '5';
  private static readonly LOGGER = new Logger(DatabaseUnavailableFilter.name);

  constructor(private readonly transientFailures: PostgresTransientFailures) {
    super();
  }

  override catch(error: unknown, host: ArgumentsHost): void {
    const http = host.getType() === 'http';

    if (!http || !this.transientFailures.includes(error)) {
      super.catch(error, host);
      return;
    }

    DatabaseUnavailableFilter.LOGGER.warn(error);
    const response = host.switchToHttp().getResponse<Response>();
    response.setHeader(
      'Retry-After',
      DatabaseUnavailableFilter.RETRY_AFTER_SECONDS,
    );
    const unavailable = new ServiceUnavailableException();
    super.catch(unavailable, host);
  }
}
