import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { ClsModule } from 'nestjs-cls';
import pg from 'pg';
import { Database } from '../../interface-adapters/interfaces.js';
import { createDatabase } from '../drizzle/client.js';
import type { Env } from './config.module.js';

@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: true },
      plugins: [
        new ClsPluginTransactional({
          adapter: new TransactionalAdapterDrizzleOrm<Database>({
            drizzleInstanceToken: Database,
          }),
        }),
      ],
    }),
  ],
  providers: [
    {
      provide: pg.Pool,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new pg.Pool({
          connectionString: config.get('DATABASE_URL', { infer: true }),
        }),
    },
    { provide: Database, inject: [pg.Pool], useFactory: createDatabase },
  ],
  exports: [Database],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(private readonly pool: pg.Pool) {}

  onApplicationShutdown(): Promise<void> {
    return this.pool.end();
  }
}
