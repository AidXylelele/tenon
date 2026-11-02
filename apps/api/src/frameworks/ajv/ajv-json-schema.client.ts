import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ResilienceService } from '@nestjs/resilience';
import type {
  JsonObject,
  JsonValue,
} from '../../domain/automation/language/interfaces.js';
import { JsonSchemaOutcomeKind } from '../../interface-adapters/workflows/schemas/enums.js';
import {
  JsonSchemaClient,
  type JsonSchemaCompilation,
  type JsonSchemaVerdict,
} from '../../interface-adapters/workflows/schemas/interfaces.js';
import { WorkerRunKind } from '../piscina/enums.js';
import { WorkerPool } from '../piscina/worker-pool.js';
import { ENGINE_CONCURRENCY } from '../workflows/engine.constants.js';
import type { AjvAnswer, AjvTask } from './ajv.worker.js';

// Ajv trusts its schemas, so an author's schema compiles and validates in a worker that the
// `schemas` preset's timeout stops when a pattern backtracks without end.
@Injectable()
export class AjvJsonSchemaClient
  implements JsonSchemaClient, OnApplicationShutdown
{
  private static readonly PRESET = 'schemas';

  private readonly workers: WorkerPool<AjvTask, AjvAnswer>;

  constructor(resilience: ResilienceService) {
    const policy = resilience.preset(AjvJsonSchemaClient.PRESET);
    // A worker per running instance and one for the checks of a publish, as for jq.
    this.workers = new WorkerPool(policy, {
      moduleUrl: import.meta.url,
      worker: 'ajv.worker',
      maxThreads: ENGINE_CONCURRENCY + 1,
      heapMb: null,
    });
  }

  async compile(schema: JsonObject): Promise<JsonSchemaCompilation> {
    const run = await this.workers.run({
      schema,
      validates: false,
      data: null,
    });

    if (run.kind !== WorkerRunKind.Done)
      return { kind: JsonSchemaOutcomeKind.TimedOut };

    const answer = run.result;

    if (answer.unusable)
      return { kind: JsonSchemaOutcomeKind.Unusable, reason: answer.reason };

    return { kind: JsonSchemaOutcomeKind.Compiled };
  }

  async validate(
    schema: JsonObject,
    data: JsonValue,
  ): Promise<JsonSchemaVerdict> {
    const run = await this.workers.run({ schema, validates: true, data });

    if (run.kind !== WorkerRunKind.Done)
      return { kind: JsonSchemaOutcomeKind.TimedOut };

    const answer = run.result;

    if (answer.unusable)
      return { kind: JsonSchemaOutcomeKind.Unusable, reason: answer.reason };

    if (!answer.valid)
      return { kind: JsonSchemaOutcomeKind.Invalid, reason: answer.reason };

    return { kind: JsonSchemaOutcomeKind.Valid };
  }

  onApplicationShutdown(): Promise<void> {
    return this.workers.close();
  }
}
