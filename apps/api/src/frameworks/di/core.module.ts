import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { HttpClientModule } from "@nestjs/http-client";
import { ResilienceModule } from "@nestjs/resilience";
import { ScheduleModule } from "@nestjs/schedule";
import { AesGcmPayloadCodec } from "@nestjs/workflows";
import { AutomationModule } from "./automation.module.js";
import { secretsConfig } from "./configs.js";
import { DatabaseModule } from "./database.module.js";
import { LoggingModule } from "./logging.module.js";
import { resiliencePresets } from "./resilience.presets.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ConfigModule.forFeature(secretsConfig),
    LoggingModule,
    DatabaseModule,
    ResilienceModule.forRoot({ presets: resiliencePresets }),
    HttpClientModule.forRoot({
      retry: false,
      throwOnHttpError: false,
      redirect: "manual",
    }),
    ScheduleModule.forRoot(),
    AutomationModule,
  ],
  providers: [
    {
      provide: AesGcmPayloadCodec,
      inject: [secretsConfig.KEY],
      useFactory: (secrets: ConfigType<typeof secretsConfig>) =>
        new AesGcmPayloadCodec({
          keys: { v1: secrets.SECRETS_KEY },
          current: "v1",
        }),
    },
  ],
  exports: [AesGcmPayloadCodec, AutomationModule],
})
export class CoreModule {}
