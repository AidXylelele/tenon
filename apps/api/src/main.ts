import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './frameworks/di/app.module.js';
import type { Env } from './frameworks/di/config.module.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule, {
  bufferLogs: true,
});
const config = app.get(ConfigService<Env, true>);

app.useLogger(app.get(Logger));
app.set('trust proxy', config.get('TRUSTED_PROXIES', { infer: true }));
app.enableCsrfProtection({
  trustedOrigins: config.get('TRUSTED_ORIGINS', { infer: true }),
});
app.setGlobalPrefix('api/v1');
app.enableShutdownHooks();

const openApi = new DocumentBuilder()
  .setTitle('Workflow Platform API')
  .setVersion('1.0.0')
  .addCookieAuth('sid', { type: 'apiKey', in: 'cookie' }, 'sessionCookie')
  .build();
SwaggerModule.setup(
  'api/v1/docs',
  app,
  SwaggerModule.createDocument(app, openApi),
  {
    jsonDocumentUrl: 'api/v1/docs-json',
  },
);

await app.listen(config.get('PORT', { infer: true }));
