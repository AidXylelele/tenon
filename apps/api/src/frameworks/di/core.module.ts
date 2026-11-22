import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpClientModule } from "@nestjs/http-client";
import { ResilienceModule } from "@nestjs/resilience";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "./database.module.js";
import { resiliencePresets } from "./host.presets.js";
import { LoggingModule } from "./logging.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    LoggingModule,
    DatabaseModule,
    ResilienceModule.forRoot({ presets: resiliencePresets }),
    HttpClientModule.forRoot({
      retry: false,
      throwOnHttpError: false,
      redirect: "manual",
    }),
    ScheduleModule.forRoot(),
  ],
})
export class CoreModule {}
