import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const openApi = new DocumentBuilder()
    .setTitle('Workflow Platform API')
    .setVersion('1.0.0')
    .addCookieAuth('sid', { type: 'apiKey', in: 'cookie' }, 'sessionCookie')
    .build();
  return SwaggerModule.createDocument(app, openApi);
}

export function serveOpenApi(app: INestApplication): void {
  const document = createOpenApiDocument(app);
  SwaggerModule.setup('api/v1/docs', app, document, {
    jsonDocumentUrl: 'api/v1/docs-json',
  });
}
