import {
  RunKind,
  ScriptLanguage,
} from '../../../domain/automation/language/enums.js';
import type {
  JsonObject,
  JsonValue,
  ProcessRun,
} from '../../../domain/automation/language/interfaces.js';
import { ProcessExited } from '../../../domain/automation/language/results/process-exited.js';
import type { ProcessResult } from '../../../domain/automation/language/results/process-result.js';
import { ProcessTimedOut } from '../../../domain/automation/language/results/process-timed-out.js';
import { SandboxFailed } from '../../../domain/automation/language/results/sandbox-failed.js';
import { GoJudgeStatus, SandboxOutcomeKind } from '../enums.js';
import type {
  GoJudgeCommand,
  GoJudgeResult,
  SandboxLimits,
  SandboxOutcome,
} from '../interfaces.js';

export class GoJudgeRunMapper {
  static readonly #OVERSIZED =
    'The output of the process is larger than the sandbox answers';
  static readonly #REFUSED = 'The sandbox refused to run the process';
  static readonly #NANOSECONDS_PER_SECOND = 1_000_000_000;
  static readonly #NANOSECONDS_PER_MILLISECOND = 1_000_000;
  static readonly #PATH = 'PATH=/usr/local/bin:/usr/bin:/bin';
  static readonly #NODE = '/usr/local/bin/node';
  static readonly #PYTHON = '/usr/bin/python3';
  static readonly #SHELL = '/bin/sh';
  static readonly #SCRIPT = 'script';

  // `timeout`: the milliseconds left before the awaiting task's deadline; null: none.
  static toCommand(
    run: ProcessRun,
    limits: SandboxLimits,
    timeout: number | null,
  ): GoJudgeCommand {
    const process = GoJudgeRunMapper.#objectOf(run.process);
    const args = GoJudgeRunMapper.#argumentsOf(process.arguments);
    const env = GoJudgeRunMapper.#environmentOf(process.environment);
    const stdin = GoJudgeRunMapper.#textOf(process.stdin);
    const limit = GoJudgeRunMapper.#limitOf(limits, timeout);
    const common = {
      env,
      files: [
        { content: stdin },
        { name: 'stdout', max: limits.outputBytes },
        { name: 'stderr', max: limits.outputBytes },
      ],
      cpuLimit: limit,
      clockLimit: limit,
      memoryLimit: limits.memoryBytes,
      procLimit: limits.processes,
    };

    if (run.kind === RunKind.Shell) {
      const command = GoJudgeRunMapper.#textOf(process.command);
      return {
        args: [GoJudgeRunMapper.#SHELL, '-c', command, 'sh'].concat(args),
        copyIn: {},
        env: common.env,
        files: common.files,
        cpuLimit: common.cpuLimit,
        clockLimit: common.clockLimit,
        memoryLimit: common.memoryLimit,
        procLimit: common.procLimit,
      };
    }

    const code = GoJudgeRunMapper.#textOf(process.code);
    const interpreter =
      run.language === ScriptLanguage.Python
        ? GoJudgeRunMapper.#PYTHON
        : GoJudgeRunMapper.#NODE;
    return {
      args: [interpreter, GoJudgeRunMapper.#SCRIPT].concat(args),
      copyIn: { [GoJudgeRunMapper.#SCRIPT]: { content: code } },
      env: common.env,
      files: common.files,
      cpuLimit: common.cpuLimit,
      clockLimit: common.clockLimit,
      memoryLimit: common.memoryLimit,
      procLimit: common.procLimit,
    };
  }

  // A sandbox that is busy, down, stuck or answers with another's page is the platform's outage,
  // not the author's error: the run gets no result and the round tries again later. A process
  // that outlives its limit is the sandbox's answer (TimeLimitExceeded), and so are go-judge's
  // own refusal of the command and an answer beyond its bound: repeating them repeats them.
  static toResult(id: string, outcome: SandboxOutcome): ProcessResult | null {
    switch (outcome.kind) {
      case SandboxOutcomeKind.Ran:
        return GoJudgeRunMapper.#resultOf(id, outcome.result);
      case SandboxOutcomeKind.Oversized:
        return new SandboxFailed(id, GoJudgeRunMapper.#OVERSIZED);
      case SandboxOutcomeKind.Failed:
        return new SandboxFailed(id, GoJudgeRunMapper.#REFUSED);
      case SandboxOutcomeKind.Rejected:
      case SandboxOutcomeKind.Unreachable:
      case SandboxOutcomeKind.Refused:
      case SandboxOutcomeKind.TimedOut:
        return null;
    }
  }

  static #resultOf(id: string, result: GoJudgeResult): ProcessResult {
    const accepted: string = GoJudgeStatus.Accepted;
    const nonzero: string = GoJudgeStatus.NonzeroExitStatus;
    const timedOut: string = GoJudgeStatus.TimeLimitExceeded;
    const exited = result.status === accepted || result.status === nonzero;

    if (exited)
      return new ProcessExited({
        id,
        code: result.exitStatus ?? 0,
        stdout: result.files?.stdout ?? '',
        stderr: result.files?.stderr ?? '',
      });

    if (result.status === timedOut) return new ProcessTimedOut(id);

    return new SandboxFailed(
      id,
      `The sandbox stopped the process: ${result.status}`,
    );
  }

  // The sandbox's own limit, or less when the task's deadline is nearer.
  static #limitOf(limits: SandboxLimits, timeout: number | null): number {
    const sandbox = limits.seconds * GoJudgeRunMapper.#NANOSECONDS_PER_SECOND;

    if (timeout === null) return sandbox;

    const remaining = Math.ceil(
      timeout * GoJudgeRunMapper.#NANOSECONDS_PER_MILLISECOND,
    );
    return Math.min(sandbox, remaining);
  }

  static #objectOf(value: JsonValue): JsonObject {
    const object =
      typeof value === 'object' && value !== null && !Array.isArray(value);

    if (!object) return {};

    return value;
  }

  static #textOf(value: JsonValue | undefined): string {
    if (typeof value === 'string') return value;

    if (value === undefined || value === null) return '';

    return JSON.stringify(value);
  }

  static #argumentsOf(value: JsonValue | undefined): readonly string[] {
    if (!Array.isArray(value)) return [];

    return value.map((item) => GoJudgeRunMapper.#textOf(item));
  }

  static #environmentOf(value: JsonValue | undefined): readonly string[] {
    const declared = GoJudgeRunMapper.#objectOf(value ?? null);
    const variables = [GoJudgeRunMapper.#PATH];

    for (const name of Object.keys(declared)) {
      const text = GoJudgeRunMapper.#textOf(declared[name]);
      variables.push(`${name}=${text}`);
    }

    return variables;
  }
}
