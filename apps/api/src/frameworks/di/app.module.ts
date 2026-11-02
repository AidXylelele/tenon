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
import { DatabaseUnavailableFilter } from '../express/database-unavailable.filter.js';
import { DatabaseHealthIndicator } from '../drizzle/database-health.indicator.js';
import { DatabaseProbe } from '../../interface-adapters/api/interfaces.js';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    // First, so its global interceptor wraps the handlers directly: the one nestjs-cls registers
    // does nothing here (the context comes from its middleware), yet would sit outside it.
    IdempotencyModule,
    DatabaseModule,
    OutboxModule,
    IdentityModule,
    AuthorizationModule.forRoot(),
    ResilienceModule,
    AutomationModule,
    TerminusModule.forRoot({ gracefulShutdownTimeoutMs: 5_000 }),
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useValue: new StandardSchemaValidationPipe() },
    // Nest asks the global filters last to first: domain errors first, the database's outages next.
    DatabaseHealthIndicator,
    { provide: DatabaseProbe, useExisting: DatabaseHealthIndicator },
    { provide: APP_FILTER, useClass: DatabaseUnavailableFilter },
    { provide: APP_FILTER, useClass: DomainErrorFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SecurityHeadersMiddleware).forRoutes('{*splat}');
  }
}
