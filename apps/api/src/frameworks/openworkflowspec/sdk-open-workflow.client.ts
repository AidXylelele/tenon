import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ResilienceService } from '@nestjs/resilience';
import type { JsonObject } from '../../domain/automation/language/interfaces.js';
import { DslOutcomeKind } from '../../interface-adapters/workflows/definitions/enums.js';
import type * as Dsl from '../../interface-adapters/workflows/definitions/interfaces.js';
import {
  type DslOutcome,
  OpenWorkflowClient,
} from '../../interface-adapters/workflows/definitions/interfaces.js';
import { WorkerRunKind } from '../piscina/enums.js';
import { WorkerPool } from '../piscina/worker-pool.js';
import type { SdkReading } from './sdk.worker.js';

// The SDK reads a document in a worker: the `documents` preset's timeout stops a reading that
// runs away, and the heap limit one that YAML aliases expand beyond what a document may hold.
@Injectable()
export class SdkOpenWorkflowClient
  implements OpenWorkflowClient, OnApplicationShutdown
{
  private static readonly PRESET = 'documents';

  private readonly workers: WorkerPool<string, SdkReading>;

  constructor(resilience: ResilienceService) {
    const policy = resilience.preset(SdkOpenWorkflowClient.PRESET);
    this.workers = new WorkerPool(policy, {
      moduleUrl: import.meta.url,
      worker: 'sdk.worker',
      maxThreads: 2,
      heapMb: 256,
    });
  }

  async parse(text: string): Promise<DslOutcome> {
    const run = await this.workers.run(text);

    if (run.kind === WorkerRunKind.TimedOut)
      return { kind: DslOutcomeKind.TimedOut };

    if (run.kind === WorkerRunKind.Exhausted)
      return { kind: DslOutcomeKind.Exhausted };

    const reading = run.result;

    if (reading.failure !== null)
      return {
        kind: DslOutcomeKind.Failure,
        pointer: reading.pointer,
        failure: reading.failure,
      };

    const workflow = reading.plain as Dsl.Workflow;
    const document = reading.plain as JsonObject;
    return { kind: DslOutcomeKind.Parsed, workflow, document };
  }

  onApplicationShutdown(): Promise<void> {
    return this.workers.close();
  }
}
