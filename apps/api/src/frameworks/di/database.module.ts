import {
  Global,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { ClsModule } from 'nestjs-cls';
import pg from 'pg';
import { Database } from '../../interface-adapters/persistence/interfaces.js';
import { createDatabase } from '../drizzle/database.js';
import type { Env } from './config.module.js';

@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
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
      useFactory: (config: ConfigService<Env, true>) => {
        // A caller waits at most 10 s for a connection, then fails with a transient error
        // that its step or message retries, instead of waiting for ever; keepalive probes
        // find a connection a partition cut, which a query would wait on.
        const pool = new pg.Pool({
          connectionString: config.get('DATABASE_URL', { infer: true }),
          max: config.get('DATABASE_POOL_SIZE', { infer: true }),
          connectionTimeoutMillis: 10_000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10_000,
        });
        // The server drops connections on a restart or a failover. An idle one reports through
        // the pool, one in use through its client; unheard, either would end the process. The
        // query in progress fails, and the pool replaces the connection.
        pool.on('error', (error) => {
          DatabaseModule.LOGGER.warn(
            `An idle connection failed: ${error.message}`,
          );
        });
        pool.on('connect', (client) => {
          client.on('error', (error) => {
            DatabaseModule.LOGGER.warn(`A connection failed: ${error.message}`);
          });
        });
        return pool;
      },
    },
    { provide: Database, inject: [pg.Pool], useFactory: createDatabase },
  ],
  exports: [Database],
})
export class DatabaseModule implements OnApplicationShutdown {
  private static readonly LOGGER = new Logger('PostgreSQL');

  constructor(private readonly pool: pg.Pool) {}

  onApplicationShutdown(): Promise<void> {
    return this.pool.end();
  }
}
