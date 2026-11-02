import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkflowsModule, WorkflowStorage } from '@nestjs/workflows';
import { systemClock } from '@nestjs/workflows/core';
import { fromDrizzle, PostgresWorkflowStore } from '@nestjs/workflows/postgres';
import { EngineClock } from '../../interface-adapters/workflows/runs/engine.clock.js';
import { Database } from '../../interface-adapters/persistence/interfaces.js';
import { ENGINE_CONCURRENCY } from '../workflows/engine.constants.js';
import type { Env } from './config.module.js';

@Module({
  providers: [
    { provide: EngineClock, useFactory: () => new EngineClock(systemClock) },
  ],
  exports: [EngineClock],
})
export class EngineClockModule {}

@Module({
  imports: [
    EngineClockModule,
    WorkflowsModule.forRootAsync({
      imports: [EngineClockModule],
      inject: [ConfigService, EngineClock],
      useFactory: (config: ConfigService<Env, true>, clock: EngineClock) => ({
        clock: clock.source,
        worker: {
          enabled: config.get('ENGINE_WORKER', { infer: true }) === 'on',
          concurrency: ENGINE_CONCURRENCY,
          leaseDuration: '120s',
          // One round's calls and processes take up to about 70 s; a shutdown lets it finish.
          shutdownTimeout: '90s',
        },
      }),
    }),
  ],
  providers: [
    {
      provide: PostgresWorkflowStore,
      inject: [Database, WorkflowStorage],
      useFactory: (db: Database, storage: WorkflowStorage) =>
        new PostgresWorkflowStore({ executor: fromDrizzle(db) }, storage),
    },
  ],
  exports: [EngineClockModule],
})
export class EngineModule {}
