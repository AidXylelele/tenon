import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import {
  type ResiliencePolicy,
  ResilienceService,
  ResilienceTimeoutError,
} from '@nestjs/resilience';
import { Piscina } from 'piscina';
import type { JsonObject } from '../../domain/automation/language/interfaces.js';
import { DslOutcomeKind } from '../../interface-adapters/workflows/definitions/enums.js';
import type * as Dsl from '../../interface-adapters/workflows/definitions/interfaces.js';
import {
  type DslOutcome,
  OpenWorkflowClient,
} from '../../interface-adapters/workflows/definitions/interfaces.js';
import type { SdkReading } from './sdk.worker.js';

// The SDK reads a document in a worker thread: the `documents` preset's timeout terminates a
// reading that runs away, and the heap limit one that expands beyond what a document may hold.
@Injectable()
export class SdkOpenWorkflowClient
  implements OpenWorkflowClient, OnApplicationShutdown
{
  private static readonly PRESET = 'documents';
  // The worker beside this file: `.ts` where the sources run (tests), `.js` in the build.
  private static readonly WORKER = new URL(
    `./sdk.worker${extname(fileURLToPath(import.meta.url))}`,
    import.meta.url,
  ).href;
  private static readonly OUT_OF_MEMORY = 'ERR_WORKER_OUT_OF_MEMORY';

  private readonly pool = new Piscina<string, SdkReading>({
    filename: SdkOpenWorkflowClient.WORKER,
    minThreads: 1,
    maxThreads: 2,
    idleTimeout: 30_000,
    resourceLimits: { maxOldGenerationSizeMb: 256 },
  });
  private readonly policy: ResiliencePolicy;

  constructor(resilience: ResilienceService) {
    this.policy = resilience.preset(SdkOpenWorkflowClient.PRESET);
  }

  async parse(text: string): Promise<DslOutcome> {
    try {
      const reading = await this.policy.execute(({ signal }) =>
        this.pool.run(text, { signal }),
      );
      return SdkOpenWorkflowClient.outcomeOf(reading);
    } catch (error) {
      return SdkOpenWorkflowClient.interruptionOf(error);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.close();
  }

  private static outcomeOf(reading: SdkReading): DslOutcome {
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

  private static interruptionOf(error: unknown): DslOutcome {
    if (error instanceof ResilienceTimeoutError)
      return { kind: DslOutcomeKind.TimedOut };

    const exhausted =
      error instanceof Error &&
      Reflect.get(error, 'code') === SdkOpenWorkflowClient.OUT_OF_MEMORY;

    if (exhausted) return { kind: DslOutcomeKind.Exhausted };

    throw error;
  }
}
