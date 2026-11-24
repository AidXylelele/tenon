import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { HttpClientModule } from "@nestjs/http-client";
import { ResilienceModule } from "@nestjs/resilience";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "./database.module.js";
import { interpreterConfig } from "./configs.js";
import { interpreterPresetsOf, resiliencePresets } from "./host.presets.js";
import { LoggingModule } from "./logging.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    LoggingModule,
    DatabaseModule,
    ResilienceModule.forRootAsync({
      imports: [ConfigModule.forFeature(interpreterConfig)],
      inject: [interpreterConfig.KEY],
      useFactory: (interpreter: ConfigType<typeof interpreterConfig>) => {
        const threads = {
          runs: interpreter.INTERPRETER_RUN_THREADS,
          checks: interpreter.INTERPRETER_CHECK_THREADS,
        };
        const interpreterPresets = interpreterPresetsOf(threads);
        return { presets: { ...resiliencePresets, ...interpreterPresets } };
      },
    }),
    HttpClientModule.forRoot({
      retry: false,
      throwOnHttpError: false,
      redirect: "manual",
    }),
    ScheduleModule.forRoot(),
  ],
})
export class CoreModule {}
