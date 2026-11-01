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
import { GoJudgeStatus } from '../enums.js';
import type {
  GoJudgeCommand,
  GoJudgeResult,
  SandboxLimits,
} from '../interfaces.js';

export class ProcessRunMapper {
  static readonly #NANOSECONDS_PER_SECOND = 1_000_000_000;
  static readonly #PATH = 'PATH=/usr/local/bin:/usr/bin:/bin';
  static readonly #NODE = '/usr/local/bin/node';
  static readonly #PYTHON = '/usr/bin/python3';
  static readonly #SHELL = '/bin/sh';
  static readonly #SCRIPT = 'script';

  static toCommand(run: ProcessRun, limits: SandboxLimits): GoJudgeCommand {
    const process = ProcessRunMapper.#objectOf(run.process);
    const args = ProcessRunMapper.#argumentsOf(process.arguments);
    const env = ProcessRunMapper.#environmentOf(process.environment);
    const stdin = ProcessRunMapper.#textOf(process.stdin);
    const limit = limits.seconds * ProcessRunMapper.#NANOSECONDS_PER_SECOND;
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
      const command = ProcessRunMapper.#textOf(process.command);
      return {
        args: [ProcessRunMapper.#SHELL, '-c', command, 'sh'].concat(args),
        copyIn: {},
        env: common.env,
        files: common.files,
        cpuLimit: common.cpuLimit,
        clockLimit: common.clockLimit,
        memoryLimit: common.memoryLimit,
        procLimit: common.procLimit,
      };
    }

    const code = ProcessRunMapper.#textOf(process.code);
    const interpreter =
      run.language === ScriptLanguage.Python
        ? ProcessRunMapper.#PYTHON
        : ProcessRunMapper.#NODE;
    return {
      args: [interpreter, ProcessRunMapper.#SCRIPT].concat(args),
      copyIn: { [ProcessRunMapper.#SCRIPT]: { content: code } },
      env: common.env,
      files: common.files,
      cpuLimit: common.cpuLimit,
      clockLimit: common.clockLimit,
      memoryLimit: common.memoryLimit,
      procLimit: common.procLimit,
    };
  }

  static toResult(id: string, result: GoJudgeResult): ProcessResult {
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

    return value.map((item) => ProcessRunMapper.#textOf(item));
  }

  static #environmentOf(value: JsonValue | undefined): readonly string[] {
    const declared = ProcessRunMapper.#objectOf(value ?? null);
    const variables = [ProcessRunMapper.#PATH];

    for (const name of Object.keys(declared)) {
      const text = ProcessRunMapper.#textOf(declared[name]);
      variables.push(`${name}=${text}`);
    }

    return variables;
  }
}
