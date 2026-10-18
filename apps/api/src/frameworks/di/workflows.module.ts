import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WorkflowsModule as NestWorkflowsModule,
  WorkflowStorage,
} from '@nestjs/workflows';
import { fromDrizzle, PostgresWorkflowStore } from '@nestjs/workflows/postgres';
import { Database } from '../../interface-adapters/interfaces.js';
import type { Env } from './config.module.js';

const ENGINE_MODULE = NestWorkflowsModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) => {
    const role = config.get('ROLE', { infer: true });
    const concurrency = config.get('WORKER_CONCURRENCY', { infer: true });
    const worker = role === 'worker' ? { concurrency } : false;
    return { worker };
  },
});

@Module({
  imports: [ENGINE_MODULE],
  providers: [
    {
      provide: PostgresWorkflowStore,
      inject: [Database, WorkflowStorage],
      useFactory: (db: Database, storage: WorkflowStorage) => {
        const executor = fromDrizzle(db);
        return new PostgresWorkflowStore({ executor }, storage);
      },
    },
  ],
})
export class WorkflowsModule {}
