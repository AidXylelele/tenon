import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './frameworks/di/app.module.js';
import type { Env } from './frameworks/di/config.module.js';
import { configureHttpApp } from './frameworks/express/configure-http-app.js';
import { serveOpenApi } from './frameworks/swagger/open-api.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule, {
  bufferLogs: true,
});
const config = app.get(ConfigService<Env, true>);

app.useLogger(app.get(Logger));
configureHttpApp(app, {
  trustedProxies: config.get('TRUSTED_PROXIES', { infer: true }),
  trustedOrigins: config.get('TRUSTED_ORIGINS', { infer: true }),
});
app.enableShutdownHooks();

serveOpenApi(app);

const servesHttp = config.get('HTTP', { infer: true }) === 'on';

if (servesHttp) {
  await app.listen(config.get('PORT', { infer: true }));
} else {
  await app.init();
}
