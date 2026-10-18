import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './frameworks/di/app.module.js';
import type { Env } from './frameworks/di/config.module.js';

async function serve(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const logger = app.get(Logger);
  const trustedProxies = config.get('TRUSTED_PROXIES', { infer: true });
  const trustedOrigins = config.get('TRUSTED_ORIGINS', { infer: true });
  const port = config.get('PORT', { infer: true });

  app.useLogger(logger);
  app.useBodyParser('json', { limit: '5mb' });
  app.useBodyParser('text', {
    type: ['text/*', 'application/xml', 'application/*+xml'],
    limit: '1mb',
  });
  app.set('trust proxy', trustedProxies);
  app.enableCsrfProtection({ trustedOrigins });
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  const openApi = new DocumentBuilder()
    .setTitle('Workflow Platform API')
    .setVersion('1.0.0')
    .addCookieAuth('sid', { type: 'apiKey', in: 'cookie' }, 'sessionCookie')
    .build();
  const specification = SwaggerModule.createDocument(app, openApi);
  SwaggerModule.setup('api/v1/docs', app, specification, {
    jsonDocumentUrl: 'api/v1/docs-json',
  });

  await app.listen(port);
}

async function work(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(Logger);

  app.useLogger(logger);
  app.enableShutdownHooks();
}

if (process.env['ROLE'] === 'worker') {
  await work();
} else {
  await serve();
}
