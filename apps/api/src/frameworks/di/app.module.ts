import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from '../../interface-adapters/http/controllers/health.controller.js';
import { DomainErrorFilter } from '../../interface-adapters/http/filters/domain-error.filter.js';
import { SecurityHeadersMiddleware } from '../../interface-adapters/http/middleware/security-headers.middleware.js';
import { ConfigModule } from './config.module.js';
import { DatabaseModule } from './database.module.js';
import { IdentityAccessModule } from './identity-access.module.js';
import { LoggingModule } from './logging.module.js';
import { MailModule } from './mail.module.js';
import { OutboxModule } from './outbox.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    DatabaseModule,
    OutboxModule,
    MailModule,
    IdentityAccessModule,
    TerminusModule.forRoot({ gracefulShutdownTimeoutMs: 5_000 }),
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_FILTER, useClass: DomainErrorFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SecurityHeadersMiddleware).forRoutes('{*splat}');
  }
}
