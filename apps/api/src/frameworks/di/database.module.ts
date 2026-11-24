import { Global, Module, type OnModuleInit } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { DrizzleModule, getDrizzleToken, InjectDrizzle } from "@nestjs/drizzle";
import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { ClsModule } from "nestjs-cls";
import type { Pool } from "pg";
import { UnitOfWork } from "../../application/unit-of-work.js";
import { MessageInbox } from "../../interface-adapters/messaging/message-inbox.js";
import type { Database } from "../../interface-adapters/persistence/interfaces.js";
import { PostgresUnitOfWork } from "../../interface-adapters/persistence/postgres-unit-of-work.js";
import * as schema from "../../interface-adapters/persistence/schema/index.js";
import { databaseConfig } from "./configs.js";

@Global()
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
          min: database.DATABASE_POOL_MIN,
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
  providers: [
    MessageInbox,
    { provide: UnitOfWork, useClass: PostgresUnitOfWork },
  ],
  exports: [MessageInbox, UnitOfWork],
})
export class DatabaseModule implements OnModuleInit {
  constructor(
    @InjectDrizzle() private readonly db: Database & { readonly $client: Pool },
  ) {}

  async onModuleInit(): Promise<void> {
    const pool = this.db.$client;
    const minimum = pool.options.min ?? 0;
    const connecting = Array.from({ length: minimum }, () => pool.connect());
    const opened = await Promise.all(connecting);

    for (const client of opened) client.release();
  }
}
