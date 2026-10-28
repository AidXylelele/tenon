import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkflowsModule, WorkflowStorage } from '@nestjs/workflows';
import { fromDrizzle, PostgresWorkflowStore } from '@nestjs/workflows/postgres';
import { Database } from '../../interface-adapters/interfaces.js';
import type { Env } from './config.module.js';

@Module({
  imports: [
    WorkflowsModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        worker: {
          enabled: config.get('ENGINE_WORKER', { infer: true }) === 'on',
          leaseDuration: '120s',
          shutdownTimeout: '10s',
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
})
export class EngineModule {}
