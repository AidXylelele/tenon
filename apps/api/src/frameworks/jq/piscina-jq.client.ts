import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ResilienceService } from '@nestjs/resilience';
import type { JsonObject, JsonValue } from '../../domain/automation/json.js';
import { JqOutcomeKind } from '../runtime/enums.js';
import {
  type JqAborted,
  JqClient,
  type JqCompilation,
  type JqEvaluation,
  type JqTimedOut,
} from '../runtime/interfaces.js';
import { WorkerRunKind } from '../piscina/enums.js';
import type { WorkerExhausted, WorkerTimedOut } from '../piscina/interfaces.js';
import { WorkerPool } from '../piscina/worker-pool.js';
import { ENGINE_CONCURRENCY } from '../workflows/engine.constants.js';
import type { JqRun, JqRunResult } from './jq.worker.js';

// jq-wasm computes synchronously, so a program runs in a worker that the `jq` preset's timeout
// stops; the client adds the sandbox prelude and reads jq's answers.
@Injectable()
export class PiscinaJqClient implements JqClient, OnApplicationShutdown {
  private static readonly PRESET = 'jq';
  private static readonly PRELUDE = [
    'def env: error("env is not available to workflow expressions");',
    'def input: error("input is not available to workflow expressions");',
    'def inputs: error("inputs is not available to workflow expressions");',
    'def input_filename: error("input_filename is not available to workflow expressions");',
    'def halt: error("halt is not available to workflow expressions");',
    'def halt_error: error("halt_error is not available to workflow expressions");',
    'def halt_error($code): error("halt_error is not available to workflow expressions");',
    'def localtime: error("localtime is not available to workflow expressions");',
    'def strflocaltime($format): error("strflocaltime is not available to workflow expressions");',
    'def debug: .;',
    'def debug($message): .;',
    'def stderr: .;',
  ].join(' ');
  private static readonly VARIABLE = /\$[A-Za-z_][A-Za-z0-9_]*/g;
  private static readonly ERROR_PREFIX = /^jq: error(?: \(at [^)]*\))?: /;
  private static readonly LOCATION =
    / at <top-level>, line \d+, column \d+:[\s\S]*$/;
  private static readonly UNBOUND = 'null';
  private static readonly COMPACT = '-c';

  private readonly workers: WorkerPool<JqRun, JqRunResult>;

  constructor(resilience: ResilienceService) {
    const policy = resilience.preset(PiscinaJqClient.PRESET);
    // A worker per running instance and one for the compilations of a publish, so a program
    // never waits behind another instance's runaway.
    this.workers = new WorkerPool(policy, {
      moduleUrl: import.meta.url,
      worker: 'jq.worker',
      maxThreads: ENGINE_CONCURRENCY + 1,
      // A program that builds a huge value (`[range(1e9)]`) ends its worker, not the process.
      heapMb: 128,
    });
  }

  async compile(program: string): Promise<JqCompilation> {
    const flags = this.#bindings(program);
    const wrapped = PiscinaJqClient.wrapped(program);
    const query = `empty | (${wrapped})`;

    const run = await this.workers.run({ input: null, query, flags });

    if (run.kind !== WorkerRunKind.Done)
      return PiscinaJqClient.interruptionOf(run);

    const result = run.result;

    if (result.aborted) return { kind: JqOutcomeKind.Aborted };

    if (result.exitCode === 0) return { kind: JqOutcomeKind.Compiled };

    const failure = PiscinaJqClient.failureOf(result.stderr);
    return { kind: JqOutcomeKind.Failure, failure };
  }

  async evaluate(
    program: string,
    data: JsonValue,
    variables: JsonObject,
  ): Promise<JqEvaluation> {
    const flags = [PiscinaJqClient.COMPACT];
    const mentioned = PiscinaJqClient.mentionsOf(program);

    // Only the arguments the program names: `$workflow` alone holds the whole document.
    for (const name of mentioned) {
      const value = variables[name];

      if (value !== undefined)
        flags.push('--argjson', name, JSON.stringify(value));
    }

    const input = JSON.stringify(data);
    const query = PiscinaJqClient.wrapped(program);

    const run = await this.workers.run({ input, query, flags });

    if (run.kind !== WorkerRunKind.Done)
      return PiscinaJqClient.interruptionOf(run);

    const result = run.result;

    if (result.aborted) return { kind: JqOutcomeKind.Aborted };

    if (result.exitCode !== 0) {
      const failure = PiscinaJqClient.failureOf(result.stderr);
      return { kind: JqOutcomeKind.Failure, failure };
    }

    const values = JSON.parse(result.stdout) as JsonValue[];
    return { kind: JqOutcomeKind.Evaluated, values };
  }

  onApplicationShutdown(): Promise<void> {
    return this.workers.close();
  }

  #bindings(program: string): string[] {
    const names = PiscinaJqClient.mentionsOf(program);
    const flags: string[] = [];

    for (const name of names)
      flags.push('--argjson', name, PiscinaJqClient.UNBOUND);

    return flags;
  }

  // The `$name`s a program mentions, read lexically: one inside a string only binds too much.
  private static mentionsOf(program: string): ReadonlySet<string> {
    const names = new Set<string>();

    for (const mention of program.matchAll(PiscinaJqClient.VARIABLE)) {
      const name = mention[0].slice(1);
      names.add(name);
    }

    return names;
  }

  // `--argjson ENV` does not shadow jq's built-in `$ENV`, and a closing bracket on its own line
  // keeps a trailing `# comment` from swallowing it.
  private static wrapped(program: string): string {
    return `${PiscinaJqClient.PRELUDE} null as $ENV | [ ${program}\n]`;
  }

  private static failureOf(stderr: string): string {
    return stderr
      .trim()
      .replace(PiscinaJqClient.ERROR_PREFIX, '')
      .replace(PiscinaJqClient.LOCATION, '');
  }

  private static interruptionOf(
    run: WorkerTimedOut | WorkerExhausted,
  ): JqTimedOut | JqAborted {
    if (run.kind === WorkerRunKind.TimedOut)
      return { kind: JqOutcomeKind.TimedOut };

    return { kind: JqOutcomeKind.Aborted };
  }
}
