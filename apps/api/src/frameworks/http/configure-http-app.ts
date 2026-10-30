import type { NestExpressApplication } from '@nestjs/platform-express';
import { type NextFunction, type Request, type Response, text } from 'express';
import {
  DocumentMediaType,
  DocumentRoute,
} from '../../interface-adapters/http/enums.js';

const PREFIX = 'api/v1';

const DOCUMENT_LIMIT = '1mb';

export interface HttpSettings {
  readonly trustedProxies: readonly string[];
  readonly trustedOrigins: readonly string[];
}

export function configureHttpApp(
  app: NestExpressApplication,
  settings: HttpSettings,
): void {
  const routes = Object.values(DocumentRoute);
  const documentPaths: readonly string[] = routes.map(
    (route) => `/${PREFIX}${route}`,
  );
  const mediaTypes = Object.values(DocumentMediaType);
  const documents = text({ type: mediaTypes, limit: DOCUMENT_LIMIT });
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
