import type { Specification } from '@openworkflowspec/sdk';
import type {
  JsonObject,
  JsonValue,
} from '../../../../../domain/automation/json.js';
import { GoJudgeStatus, SandboxOutcomeKind } from '../../../enums.js';
import type {
  SandboxClient,
  SandboxLimits,
  SandboxOutcome,
} from '../../../interfaces.js';
import type { LeafKind, LeafResult } from '../../endings.js';
import type { Evaluator } from '../../evaluator.js';
import { CapacityExhaustedError, ErrorKind, TaskFault } from '../../faults.js';
import type { Scope } from '../../scope.js';
import { ProcessCommands } from './process-commands.js';

// `run: script` and `run: shell`, awaited: the process runs in the go-judge sandbox (no network,
// bounded time, memory and output) and its `return` picks the output — its standard output by
// default, its standard error, its exit code, all three, or nothing. A process that exits with
// another code than 0 faults the task, unless its `return` asks for the code. An outage of the
// sandbox is the platform's, so the engine repeats the step later.
export class ProcessKind implements LeafKind {
  static readonly #REPORTING_CODE = new Set(['code', 'all']);
  static readonly #DETAIL_LENGTH = 2_000;
  static readonly #CUT = '…';

  constructor(
    private readonly sandbox: SandboxClient,
    private readonly limits: SandboxLimits,
    private readonly evaluator: Evaluator,
  ) {}

  async run(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<LeafResult> {
    const declared = ((task as Specification.RunTask).run ?? {}) as JsonValue;
    const process = (await this.evaluator.template(
      declared,
      input,
      args,
      scope.pointer,
    )) as JsonObject;
    const command = ProcessCommands.of(process, this.limits);
    const outcome = await this.sandbox.run(command);
    const returned = ProcessCommands.textOf(process.return ?? 'stdout');
    const output = ProcessKind.#outputOf(outcome, returned, scope);
    return { output, then: null };
  }

  static #outputOf(
    outcome: SandboxOutcome,
    returned: string,
    scope: Scope,
  ): JsonValue {
    if (outcome.kind === SandboxOutcomeKind.Oversized)
      throw TaskFault.of(
        ErrorKind.Runtime,
        scope.pointer,
        'The output of the process is larger than the sandbox answers',
      );

    if (outcome.kind === SandboxOutcomeKind.Failed)
      throw TaskFault.of(
        ErrorKind.Runtime,
        scope.pointer,
        'The sandbox refused to run the process',
      );

    if (outcome.kind !== SandboxOutcomeKind.Ran)
      throw new CapacityExhaustedError();

    const result = outcome.result;
    const exited =
      result.status === (GoJudgeStatus.Accepted as string) ||
      result.status === (GoJudgeStatus.NonzeroExitStatus as string);

    if (result.status === (GoJudgeStatus.TimeLimitExceeded as string))
      throw TaskFault.of(
        ErrorKind.Timeout,
        scope.pointer,
        'The process outlasted its time limit',
      );

    if (!exited)
      throw TaskFault.of(
        ErrorKind.Runtime,
        scope.pointer,
        `The sandbox stopped the process: ${result.status}`,
      );

    const code = result.exitStatus ?? 0;
    const stdout = result.files?.stdout ?? '';
    const stderr = result.files?.stderr ?? '';
    const reported = ProcessKind.#REPORTING_CODE.has(returned);

    // As Synapse's runner does: the process failed, and its standard error says why.
    if (code !== 0 && !reported) {
      const detail = ProcessKind.#detailOf(stderr, code);
      throw TaskFault.of(ErrorKind.Runtime, scope.pointer, detail);
    }

    if (returned === 'stderr') return stderr;

    if (returned === 'code') return code;

    if (returned === 'all') return { code, stdout, stderr };

    if (returned === 'none') return null;

    return stdout;
  }

  // The standard error trimmed, cut to its end when long (a traceback ends with the error it
  // raised), or the exit code when the process wrote none.
  static #detailOf(stderr: string, code: number): string {
    const text = stderr.trim();

    if (text === '') return `The process exited with code ${String(code)}`;

    if (text.length <= ProcessKind.#DETAIL_LENGTH) return text;

    const from = text.length - ProcessKind.#DETAIL_LENGTH;
    const end = text.slice(from);
    return `${ProcessKind.#CUT}${end}`;
  }
}
