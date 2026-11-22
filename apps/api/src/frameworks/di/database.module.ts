import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { DrizzleModule, getDrizzleToken } from "@nestjs/drizzle";
import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { ClsModule } from "nestjs-cls";
import type { Database } from "../../interface-adapters/persistence/interfaces.js";
import * as schema from "../../interface-adapters/persistence/schema/index.js";
import { databaseConfig } from "./configs.js";

@Module({
  imports: [
    DrizzleModule.forRootAsync({
      imports: [ConfigModule.forFeature(databaseConfig)],
      inject: [databaseConfig.KEY],
      useFactory: (database: ConfigType<typeof databaseConfig>) => ({
        drizzle,
        connection: {
          connectionString: database.DATABASE_URL,
          max: database.DATABASE_POOL_SIZE,
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
