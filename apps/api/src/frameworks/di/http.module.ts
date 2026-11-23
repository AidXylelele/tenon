import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  StandardSchemaValidationPipe,
} from "@nestjs/common";
import { AuthenticationModule } from "@nestjs/authentication";
import { AuthorizationModule } from "@nestjs/authorization";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";
import { IdempotencyModule } from "@nestjs/idempotency";
import { TerminusModule } from "@nestjs/terminus";
import type { User } from "../../domain/identity/users/user.js";
import { HealthController } from "../../interface-adapters/api/controllers/health.controller.js";
import { JsonOnlyMiddleware } from "../../interface-adapters/api/pipeline/json-only.middleware.js";
import { ProblemDetailsFilter } from "../../interface-adapters/api/pipeline/problem-details.filter.js";
import { ProblemPresenter } from "../../interface-adapters/api/presenters/problem.presenter.js";
import { IdempotencyJobs } from "../../interface-adapters/jobs/idempotency.jobs.js";
import { PostgresIdempotencyStore } from "../../interface-adapters/persistence/stores/postgres-idempotency.store.js";
import { httpConfig, linksConfig } from "./configs.js";

@Module({
  imports: [
    ConfigModule.forFeature(httpConfig),
    AuthenticationModule.forRootAsync({
      imports: [
        ConfigModule.forFeature(httpConfig),
        ConfigModule.forFeature(linksConfig),
      ],
      inject: [httpConfig.KEY, linksConfig.KEY],
      useFactory: (
        http: ConfigType<typeof httpConfig>,
        links: ConfigType<typeof linksConfig>,
      ) => ({
        session: {
          absoluteTtl: "30d",
          idleTtl: "7d",
          cookie: { secure: http.SESSION_COOKIE_SECURE, sameSite: "lax" },
          trustedOrigins: http.TRUSTED_ORIGINS,
          metadata: (request) => ({
            ip: request.ip,
            userAgent: request.headers["user-agent"],
          }),
        },
        passwordReset: {
          url: `${links.WEB_BASE_URL}/reset-password`,
          ttl: "1h",
        },
      }),
    }),
    AuthorizationModule.forRoot(),
    IdempotencyModule.forRoot({
      scope: (request: { readonly user?: User }) => request.user?.id,
    }),
    TerminusModule.forRoot({ gracefulShutdownTimeoutMs: 5_000 }),
  ],
  controllers: [HealthController],
  providers: [
    IdempotencyJobs,
    PostgresIdempotencyStore,
    ProblemPresenter,
    {
      provide: APP_PIPE,
      useValue: new StandardSchemaValidationPipe({
        validateCustomDecorators: true,
      }),
    },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
  exports: [ProblemPresenter],
})
export class HttpModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(JsonOnlyMiddleware)
      .exclude("events", "hooks/{*token}")
      .forRoutes("{*splat}");
  }
}
