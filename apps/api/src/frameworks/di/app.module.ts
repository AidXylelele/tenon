import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AuthorizationModule } from '@nestjs/authorization';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from '../../interface-adapters/api/controllers/health.controller.js';
import { DomainErrorFilter } from '../../interface-adapters/api/filters/domain-error.filter.js';
import { SecurityHeadersMiddleware } from '../../interface-adapters/api/middleware/security-headers.middleware.js';
import { AutomationModule } from './automation.module.js';
import { ConfigModule } from './config.module.js';
import { DatabaseModule } from './database.module.js';
import { IdempotencyModule } from './idempotency.module.js';
import { IdentityModule } from './identity.module.js';
import { LoggingModule } from './logging.module.js';
import { OutboxModule } from './outbox.module.js';
import { ResilienceModule } from './resilience.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    DatabaseModule,
    OutboxModule,
    IdempotencyModule,
    IdentityModule,
    AuthorizationModule.forRoot(),
    ResilienceModule,
    AutomationModule,
    TerminusModule.forRoot({ gracefulShutdownTimeoutMs: 5_000 }),
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useValue: new StandardSchemaValidationPipe() },
    { provide: APP_FILTER, useClass: DomainErrorFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SecurityHeadersMiddleware).forRoutes('{*splat}');
  }
}
