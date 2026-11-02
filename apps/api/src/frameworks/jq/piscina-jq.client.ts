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
import { JqOutcomeKind } from '../../interface-adapters/workflows/expressions/enums.js';
import {
  JqClient,
  type JqCompilation,
  type JqEvaluation,
  type JqTimedOut,
} from '../../interface-adapters/workflows/expressions/interfaces.js';
import { ENGINE_CONCURRENCY } from '../workflows/engine.constants.js';
import type { JqRun, JqRunResult } from './jq.worker.js';

// jq-wasm computes synchronously, so a runaway program is stopped by terminating the worker
// thread it runs on: the `jq` preset's timeout aborts the task, and Piscina terminates its worker.
@Injectable()
export class PiscinaJqClient implements JqClient, OnApplicationShutdown {
  private static readonly PRESET = 'jq';
  // The worker beside this file: `.ts` where the sources run (tests), `.js` in the build.
  private static readonly WORKER = new URL(
    `./jq.worker${extname(fileURLToPath(import.meta.url))}`,
    import.meta.url,
  ).href;
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

  // A worker per running instance and one for the compilations of a publish, so a program
  // never waits behind another instance's runaway; idle workers beyond one stop after 30 s.
  private readonly pool = new Piscina<JqRun, JqRunResult>({
    filename: PiscinaJqClient.WORKER,
    minThreads: 1,
    maxThreads: ENGINE_CONCURRENCY + 1,
    idleTimeout: 30_000,
  });
  private readonly policy: ResiliencePolicy;

  constructor(resilience: ResilienceService) {
    this.policy = resilience.preset(PiscinaJqClient.PRESET);
  }

  async compile(program: string): Promise<JqCompilation> {
    const flags = this.#bindings(program);
    const wrapped = PiscinaJqClient.wrapped(program);
    const query = `empty | (${wrapped})`;

    try {
      const result = await this.#run({ input: null, query, flags });

      if (result.aborted) return { kind: JqOutcomeKind.Aborted };

      if (result.exitCode === 0) return { kind: JqOutcomeKind.Compiled };

      const failure = PiscinaJqClient.failureOf(result.stderr);
      return { kind: JqOutcomeKind.Failure, failure };
    } catch (error) {
      return PiscinaJqClient.interruptionOf(error);
    }
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

    try {
      const result = await this.#run({ input, query, flags });

      if (result.aborted) return { kind: JqOutcomeKind.Aborted };

      if (result.exitCode !== 0) {
        const failure = PiscinaJqClient.failureOf(result.stderr);
        return { kind: JqOutcomeKind.Failure, failure };
      }

      const values = JSON.parse(result.stdout) as JsonValue[];
      return { kind: JqOutcomeKind.Evaluated, values };
    } catch (error) {
      return PiscinaJqClient.interruptionOf(error);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.close();
  }

  async #run(task: JqRun): Promise<JqRunResult> {
    return this.policy.execute(({ signal }) => this.pool.run(task, { signal }));
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

  private static interruptionOf(error: unknown): JqTimedOut {
    if (error instanceof ResilienceTimeoutError)
      return { kind: JqOutcomeKind.TimedOut };

    throw error;
  }
}
