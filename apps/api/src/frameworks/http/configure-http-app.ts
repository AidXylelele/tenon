import type { NestExpressApplication } from '@nestjs/platform-express';
import { type NextFunction, type Request, type Response, text } from 'express';
import {
  DOCUMENT_LIMIT,
  DOCUMENT_MEDIA_TYPES,
  DOCUMENT_ROUTES,
} from '../../interface-adapters/http/parsers/dsl-document.parser.js';

const PREFIX = 'api/v1';

export interface HttpSettings {
  readonly trustedProxies: readonly string[];
  readonly trustedOrigins: readonly string[];
}

export function configureHttpApp(
  app: NestExpressApplication,
  settings: HttpSettings,
): void {
  const documentPaths = DOCUMENT_ROUTES.map((route) => `/${PREFIX}${route}`);
  const documents = text({ type: DOCUMENT_MEDIA_TYPES, limit: DOCUMENT_LIMIT });
  app.set('trust proxy', settings.trustedProxies);
  app.enableCsrfProtection({ trustedOrigins: settings.trustedOrigins.slice() });
  app.setGlobalPrefix(PREFIX);
  app.use((request: Request, response: Response, next: NextFunction) => {
    const isDocument =
      request.method === 'POST' && documentPaths.includes(request.path);

    if (!isDocument) {
      next();
      return;
    }

    documents(request, response, next);
  });
}
