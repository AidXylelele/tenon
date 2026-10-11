import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OutboxModule as NestOutboxModule,
  OutboxStorage,
} from '@nestjs/outbox';
import { fromDrizzle, PostgresOutboxStore } from '@nestjs/outbox/postgres';
import { Database } from '../../interface-adapters/interfaces.js';
import type { Env } from './config.module.js';

@Module({
  imports: [
    NestOutboxModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        relay: {
          enabled: config.get('OUTBOX_RELAY', { infer: true }) === 'on',
        },
        retry: { attempts: 20 },
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
