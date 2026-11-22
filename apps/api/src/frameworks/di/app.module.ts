import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  StandardSchemaValidationPipe,
} from "@nestjs/common";
import { AuthenticationModule } from "@nestjs/authentication";
import { AuthorizationModule } from "@nestjs/authorization";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core";
import { HttpClientModule } from "@nestjs/http-client";
import { IdempotencyModule } from "@nestjs/idempotency";
import { getDrizzleToken } from "@nestjs/drizzle";
import { LocksModule } from "@nestjs/locks";
import { MailModule, SmtpTransport } from "@nestjs/mail";
import { OutboxModule, OutboxStorage } from "@nestjs/outbox";
import {
  fromDrizzle as outboxExecutorOf,
  PostgresOutboxStore,
} from "@nestjs/outbox/postgres";
import { ResilienceModule } from "@nestjs/resilience";
import { ScheduleModule } from "@nestjs/schedule";
import { TerminusModule } from "@nestjs/terminus";
import { minutes, ThrottlerModule } from "@nestjs/throttler";
import {
  AesGcmPayloadCodec,
  WorkflowsModule,
  WorkflowStorage,
} from "@nestjs/workflows";
import {
  fromDrizzle as engineExecutorOf,
  PostgresWorkflowStore,
} from "@nestjs/workflows/postgres";
import type { Request } from "express";
import { LoggerModule } from "nestjs-pino";
import type { User } from "../../domain/identity/user.js";
import { accountEmail } from "../../interface-adapters/api/auth/account-email.js";
import { HealthController } from "../../interface-adapters/api/controllers/health.controller.js";
import { ProblemDetailsFilter } from "../../interface-adapters/api/filters/problem-details.filter.js";
import { RetryAfterThrottlerGuard } from "../../interface-adapters/api/guards/retry-after-throttler.guard.js";
import { JsonOnlyMiddleware } from "../../interface-adapters/api/middleware/json-only.middleware.js";
import { DatabaseHealthIndicator } from "../../interface-adapters/persistence/database.health-indicator.js";
import type { Database } from "../../interface-adapters/persistence/interfaces.js";
import { PostgresIdempotencyStore } from "../../interface-adapters/persistence/stores/postgres-idempotency.store.js";
import { PostgresLockStore } from "../../interface-adapters/persistence/stores/postgres-lock.store.js";
import { AuthenticationLogger } from "../authentication/authentication.logger.js";
import { WorkerInterpreterClient } from "../interpreter/worker-interpreter.client.js";
import { OutboxLogger } from "../outbox/outbox.logger.js";
import { createHttpLoggerOptions } from "../pino/http-logger.js";
import { ResilienceLogger } from "../resilience/resilience.logger.js";
import { RetentionJobs } from "../schedule/retention.jobs.js";
import { EngineLogger } from "../workflows/engine.logger.js";
import { AutomationModule } from "./automation.module.js";
import { DatabaseModule } from "./database.module.js";
import { type Env, envSchema } from "./env.schema.js";
import { IdentityModule } from "./identity.module.js";
import { resiliencePresets } from "./resilience.presets.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: envSchema,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: createHttpLoggerOptions(
          config.get("LOG_LEVEL", { infer: true }),
          config.get("NODE_ENV", { infer: true }) === "development",
        ),
      }),
    }),
    IdempotencyModule.forRoot({
      scope: (request: { readonly user?: User }) => request.user?.id,
    }),
    DatabaseModule,
    OutboxModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        relay: {
          enabled: config.get("OUTBOX_RELAY", { infer: true }) === "on",
          lease: "120s",
          publishTimeout: "60s",
        },
      }),
    }),
    WorkflowsModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        retry: {
          attempts: 10,
          backoff: { delay: "1s", maxDelay: "1m", jitter: "equal" },
        },
        codec: new AesGcmPayloadCodec({
          keys: { v1: config.get("SECRETS_KEY", { infer: true }) },
          current: "v1",
        }),
        worker: {
          enabled: config.get("ENGINE_WORKER", { infer: true }) === "on",
          concurrency: WorkerInterpreterClient.RUN_THREADS,
          pollInterval: "100ms",
          leaseDuration: "120s",
          shutdownTimeout: "90s",
        },
      }),
    }),
    ResilienceModule.forRoot({ presets: resiliencePresets }),
    HttpClientModule.forRoot({
      retry: false,
      throwOnHttpError: false,
      redirect: "manual",
    }),
    MailModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        transport: new SmtpTransport({
          host: config.get("SMTP_HOST", { infer: true }),
          port: config.get("SMTP_PORT", { infer: true }),
          startTls: config.get("SMTP_STARTTLS", { infer: true }),
          auth: config.get("SMTP_USER", { infer: true })
            ? {
                user: config.get("SMTP_USER", { infer: true }),
                pass: config.get("SMTP_PASSWORD", { infer: true }),
              }
            : undefined,
          pool: true,
        }),
        from: config.get("SMTP_FROM", { infer: true }),
      }),
    }),
    ThrottlerModule.forRoot([
      { name: "default", ttl: minutes(1), limit: 1_000 },
      {
        name: "account",
        ttl: minutes(15),
        limit: 10,
        skipIf: (context) => {
          const request = context.switchToHttp().getRequest<Request>();
          return accountEmail(request) === "";
        },
        getTracker: (_request, context) => {
          const request = context.switchToHttp().getRequest<Request>();
          return accountEmail(request);
        },
      },
    ]),
    AuthenticationModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        session: {
          absoluteTtl: "30d",
          idleTtl: "7d",
          cookie: {
            secure: config.get("SESSION_COOKIE_SECURE", { infer: true }),
            sameSite: "lax",
          },
          trustedOrigins: config.get("TRUSTED_ORIGINS", { infer: true }),
          metadata: (request) => ({
            ip: request.ip,
            userAgent: request.headers["user-agent"],
          }),
        },
        passwordReset: {
          url: `${config.get("WEB_BASE_URL", { infer: true })}/reset-password`,
          ttl: "1h",
        },
      }),
    }),
    AuthorizationModule.forRoot(),
    TerminusModule.forRoot({ gracefulShutdownTimeoutMs: 5_000 }),
    ScheduleModule.forRoot(),
    LocksModule.forRoot(),
    IdentityModule,
    AutomationModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new StandardSchemaValidationPipe({
        validateCustomDecorators: true,
      }),
    },
    { provide: APP_GUARD, useClass: RetryAfterThrottlerGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    DatabaseHealthIndicator,
    PostgresIdempotencyStore,
    PostgresLockStore,
    RetentionJobs,
    ResilienceLogger,
    OutboxLogger,
    EngineLogger,
    AuthenticationLogger,
    {
      provide: PostgresOutboxStore,
      inject: [getDrizzleToken(), OutboxStorage],
      useFactory: (db: Database, storage: OutboxStorage) =>
        new PostgresOutboxStore({ executor: outboxExecutorOf(db) }, storage),
    },
    {
      provide: PostgresWorkflowStore,
      inject: [getDrizzleToken(), WorkflowStorage],
      useFactory: (db: Database, storage: WorkflowStorage) =>
        new PostgresWorkflowStore({ executor: engineExecutorOf(db) }, storage),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(JsonOnlyMiddleware)
      .exclude("events", "hooks/{*token}")
      .forRoutes("{*splat}");
  }
}
