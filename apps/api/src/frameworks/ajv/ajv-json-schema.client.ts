import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import {
  type ResiliencePolicy,
  ResilienceService,
  ResilienceTimeoutError,
} from '@nestjs/resilience';
import { Piscina } from 'piscina';
import type {
  JsonObject,
  JsonValue,
} from '../../domain/automation/language/interfaces.js';
import { JsonSchemaOutcomeKind } from '../../interface-adapters/workflows/schemas/enums.js';
import {
  JsonSchemaClient,
  type JsonSchemaCompilation,
  type JsonSchemaTimedOut,
  type JsonSchemaVerdict,
} from '../../interface-adapters/workflows/schemas/interfaces.js';
import { ENGINE_CONCURRENCY } from '../workflows/engine.constants.js';
import type { AjvAnswer, AjvTask } from './ajv.worker.js';

// Ajv runs author schemas in worker threads: the `schemas` preset's timeout terminates the
// worker of a validation that backtracks without end.
@Injectable()
export class AjvJsonSchemaClient
  implements JsonSchemaClient, OnApplicationShutdown
{
  private static readonly PRESET = 'schemas';
  // The worker beside this file: `.ts` where the sources run (tests), `.js` in the build.
  private static readonly WORKER = new URL(
    `./ajv.worker${extname(fileURLToPath(import.meta.url))}`,
    import.meta.url,
  ).href;

  // A worker per running instance and one for the checks of a publish, as for jq.
  private readonly pool = new Piscina<AjvTask, AjvAnswer>({
    filename: AjvJsonSchemaClient.WORKER,
    minThreads: 1,
    maxThreads: ENGINE_CONCURRENCY + 1,
    idleTimeout: 30_000,
  });
  private readonly policy: ResiliencePolicy;

  constructor(resilience: ResilienceService) {
    this.policy = resilience.preset(AjvJsonSchemaClient.PRESET);
  }

  async compile(schema: JsonObject): Promise<JsonSchemaCompilation> {
    try {
      const answer = await this.#run({ schema, validates: false, data: null });

      if (answer.unusable)
        return { kind: JsonSchemaOutcomeKind.Unusable, reason: answer.reason };

      return { kind: JsonSchemaOutcomeKind.Compiled };
    } catch (error) {
      return AjvJsonSchemaClient.interruptionOf(error);
    }
  }

  async validate(
    schema: JsonObject,
    data: JsonValue,
  ): Promise<JsonSchemaVerdict> {
    try {
      const answer = await this.#run({ schema, validates: true, data });

      if (answer.unusable)
        return { kind: JsonSchemaOutcomeKind.Unusable, reason: answer.reason };

      if (!answer.valid)
        return { kind: JsonSchemaOutcomeKind.Invalid, reason: answer.reason };

      return { kind: JsonSchemaOutcomeKind.Valid };
    } catch (error) {
      return AjvJsonSchemaClient.interruptionOf(error);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.close();
  }

  async #run(task: AjvTask): Promise<AjvAnswer> {
    return this.policy.execute(({ signal }) => this.pool.run(task, { signal }));
  }

  private static interruptionOf(error: unknown): JsonSchemaTimedOut {
    if (error instanceof ResilienceTimeoutError)
      return { kind: JsonSchemaOutcomeKind.TimedOut };

    throw error;
  }
}
