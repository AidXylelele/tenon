import type {
  JsonObject,
  JsonValue,
} from '../../../../../domain/automation/json.js';
import { GoJudgeOutput } from '../../../enums.js';
import type { GoJudgeCommand, SandboxLimits } from '../../../interfaces.js';

// The go-judge command of a script or a shell command: its code or command line, its arguments,
// its environment (with a PATH) and its standard input, within the sandbox's limits.
export class ProcessCommands {
  static readonly #NANOSECONDS_PER_SECOND = 1_000_000_000;
  static readonly #PATH = 'PATH=/usr/local/bin:/usr/bin:/bin';
  static readonly #NODE = '/usr/local/bin/node';
  static readonly #PYTHON = '/usr/bin/python3';
  static readonly #SHELL = '/bin/sh';
  static readonly #SCRIPT = 'script';

  static of(process: JsonObject, limits: SandboxLimits): GoJudgeCommand {
    const script = process.script as JsonObject | undefined;
    const shell = process.shell as JsonObject | undefined;
    const declared = script ?? shell ?? {};
    const args = ProcessCommands.#argumentsOf(declared.arguments);
    const limit = limits.seconds * ProcessCommands.#NANOSECONDS_PER_SECOND;
    const stdin = ProcessCommands.textOf(declared.stdin);
    const files = [
      { content: stdin },
      { name: GoJudgeOutput.Stdout, max: limits.outputBytes },
      { name: GoJudgeOutput.Stderr, max: limits.outputBytes },
    ];
    const env = ProcessCommands.#environmentOf(declared.environment);
    const bounds = {
      env,
      files,
      cpuLimit: limit,
      clockLimit: limit,
      memoryLimit: limits.memoryBytes,
      procLimit: limits.processes,
    };

    if (script === undefined) {
      const command = ProcessCommands.textOf(declared.command);
      const line = [ProcessCommands.#SHELL, '-c', command, 'sh'].concat(args);
      return Object.assign({ args: line, copyIn: {} }, bounds);
    }

    const python = declared.language === 'python';
    const interpreter = python
      ? ProcessCommands.#PYTHON
      : ProcessCommands.#NODE;
    const code = ProcessCommands.textOf(declared.code);
    const line = [interpreter, ProcessCommands.#SCRIPT].concat(args);
    const copyIn = { [ProcessCommands.#SCRIPT]: { content: code } };
    return Object.assign({ args: line, copyIn }, bounds);
  }

  static textOf(value: JsonValue | undefined): string {
    if (typeof value === 'string') return value;

    if (value === undefined || value === null) return '';

    return JSON.stringify(value);
  }

  static #argumentsOf(value: JsonValue | undefined): string[] {
    if (!Array.isArray(value)) return [];

    return value.map((item) => ProcessCommands.textOf(item));
  }

  static #environmentOf(value: JsonValue | undefined): string[] {
    const declared =
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value
        : {};
    const variables = [ProcessCommands.#PATH];

    for (const [name, item] of Object.entries(declared))
      variables.push(`${name}=${ProcessCommands.textOf(item)}`);

    return variables;
  }
}
