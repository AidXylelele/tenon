import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DrizzleModule, getDrizzleToken } from "@nestjs/drizzle";
import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { ClsModule } from "nestjs-cls";
import type { Database } from "../../interface-adapters/persistence/interfaces.js";
import * as schema from "../../interface-adapters/persistence/schema/index.js";
import type { Env } from "./env.schema.js";

@Module({
  imports: [
    DrizzleModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        drizzle,
        connection: {
          connectionString: config.get("DATABASE_URL", { infer: true }),
          max: config.get("DATABASE_POOL_SIZE", { infer: true }),
          connectionTimeoutMillis: 10_000,
          keepAlive: true,
        },
        schema,
        casing: "snake_case" as const,
      }),
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
      plugins: [
        new ClsPluginTransactional({
          adapter: new TransactionalAdapterDrizzleOrm<Database>({
            drizzleInstanceToken: getDrizzleToken(),
          }),
        }),
      ],
    }),
  ],
})
export class DatabaseModule {}
