import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

const PREFIX = 'api/v1';

// A workflow document or a start's input carries up to 1 MiB (spec, Assumptions).
const JSON_LIMIT = '1mb';

const JSON_TYPES = ['application/json', 'application/*+json'];

export interface HttpSettings {
  readonly trustedProxies: readonly string[];
  readonly trustedOrigins: readonly string[];
}

export function configureHttpApp(
  app: NestExpressApplication,
  settings: HttpSettings,
): void {
  app.set('trust proxy', settings.trustedProxies);
  app.disable('x-powered-by');
  app.enableCsrfProtection({ trustedOrigins: settings.trustedOrigins.slice() });
  app.setGlobalPrefix(PREFIX);
  app.use(refuseOtherMediaTypes);
  app.useBodyParser('json', { limit: JSON_LIMIT });
}

// The API reads JSON only: a body of another media type is refused before any route reads it.
function refuseOtherMediaTypes(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const length = request.headers['content-length'];
  const chunked = request.headers['transfer-encoding'] !== undefined;
  const hasBody = chunked || (length !== undefined && length !== '0');
  const json = typeof request.is(JSON_TYPES) === 'string';

  if (!hasBody || json) {
    next();
    return;
  }

  response.status(415).json({
    statusCode: 415,
    error: 'Unsupported Media Type',
    message: 'The API reads application/json only',
  });
}
