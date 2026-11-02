import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OutboxModule as NestOutboxModule,
  OutboxStorage,
} from '@nestjs/outbox';
import { fromDrizzle, PostgresOutboxStore } from '@nestjs/outbox/postgres';
import { Database } from '../../interface-adapters/persistence/interfaces.js';
import type { Env } from './config.module.js';

@Module({
  imports: [
    NestOutboxModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        relay: {
          enabled: config.get('OUTBOX_RELAY', { infer: true }) === 'on',
          // A detached process may run for the sandbox's 35 s budget, so a publish gets 60 s.
          lease: '120s',
          publishTimeout: '60s',
        },
      }),
    }),
  ],
  providers: [
    {
      provide: PostgresOutboxStore,
      inject: [Database, OutboxStorage],
      useFactory: (db: Database, storage: OutboxStorage) =>
        new PostgresOutboxStore({ executor: fromDrizzle(db) }, storage),
    },
  ],
})
export class OutboxModule {}
