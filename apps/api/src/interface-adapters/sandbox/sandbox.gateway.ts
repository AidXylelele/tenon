import { Injectable } from "@nestjs/common";
import type { ProcessOutcome, Script, Shell } from "interpreter";
import { ProcessPlatform } from "../../application/automation/host/queries.js";
import { TransportFailure } from "../http/enums.js";
import type { FetchedText } from "../http/interfaces.js";
import { ResourceGateway } from "../http/resource.gateway.js";
import { TransportFault } from "../http/transport-fault.error.js";
import type { CallContext } from "../workflows/effects/interfaces.js";
import {
  type BuiltCommand,
  SandboxClient,
  type SandboxCommand,
  type SandboxedProcessRequest,
  type SandboxFile,
  type SandboxResult,
  type SandboxRun,
  type ScriptLanguage,
} from "./interfaces.js";
import { JavaScript } from "./javascript.js";
import { Python } from "./python.js";
import { SandboxLimits } from "./sandbox-limits.js";

@Injectable()
export class SandboxGateway {
  private static readonly DIRECTORY = "directory";
  private static readonly ENTER_DIRECTORY =
    'cd -- "$1" 2>&3 || exit\nexec 3>&-\nshift\n';

  private readonly languages: Readonly<
    Record<Script["language"], ScriptLanguage>
  > = { js: new JavaScript(), python: new Python() };

  constructor(
    private readonly client: SandboxClient,
    private readonly resources: ResourceGateway,
    private readonly limits: SandboxLimits,
    private readonly platform: ProcessPlatform,
  ) {}

  async perform(
    request: SandboxedProcessRequest,
    context: CallContext,
  ): Promise<ProcessOutcome> {
    const built = await this.#commandOf(request.process, context);

    if (built.kind !== "command") return built;

    try {
      const run = await this.client.run(built.command, context.signal);
      return this.#outcomeOf(run);
    } catch (error) {
      const expired =
        error instanceof TransportFault &&
        error.reason === TransportFailure.Expired;

      if (expired) return { kind: "expired" };

      throw error;
    }
  }

  async #commandOf(
    process: Script | Shell,
    context: CallContext,
  ): Promise<BuiltCommand> {
    if (process.kind === "shell")
      return this.#shellCommandOf(process, context.remaining);

    return this.#scriptCommandOf(process, context);
  }

  #shellCommandOf(shell: Shell, remaining: number | null): BuiltCommand {
    const args = this.#shellArgumentsOf(shell);
    const command = this.#sandboxCommandOf(args, {}, shell, remaining);
    return { kind: "command", command };
  }

  #shellArgumentsOf(shell: Shell): readonly string[] {
    const invoked = [this.platform.shell.shell, "-c"];

    if (shell.directory === null)
      return invoked.concat(shell.command, "sh", shell.arguments);

    const entering = `${SandboxGateway.ENTER_DIRECTORY}${shell.command}`;
    return invoked.concat(entering, "sh", shell.directory, shell.arguments);
  }

  async #scriptCommandOf(
    script: Script,
    context: CallContext,
  ): Promise<BuiltCommand> {
    const code = await this.#codeOf(script, context);

    if (code.kind !== "text") return code;

    const language = this.languages[script.language];
    const names = Object.keys(script.arguments);
    const declarable = names.every((name) => language.declares(name));

    if (!declarable)
      return {
        kind: "misconfigured",
        detail:
          "An argument of the script is not a variable name of its language",
      };

    const declarations = names.map((name) => {
      const value = script.arguments[name] ?? null;
      return language.declarationOf(name, value);
    });
    const program = declarations.concat(code.text).join("\n");
    const copyIn = { script: { content: program } };
    const args = [language.interpreter, "script"];
    const remaining = context.remaining;
    const command = this.#sandboxCommandOf(args, copyIn, script, remaining);
    return { kind: "command", command };
  }

  async #codeOf(script: Script, context: CallContext): Promise<FetchedText> {
    if (script.source === null)
      return { kind: "text", text: script.code ?? "" };

    return this.resources.text(script.source, context);
  }

  #sandboxCommandOf(
    args: readonly string[],
    copyIn: Readonly<Record<string, SandboxFile>>,
    process: Script | Shell,
    remaining: number | null,
  ): SandboxCommand {
    const limit = this.limits.nanosecondsWithin(remaining);
    const variables = Object.entries(process.environment).map(
      ([name, value]) => `${name}=${value}`,
    );
    const env = ["PATH=/usr/local/bin:/usr/bin:/bin"].concat(variables);
    return {
      args,
      env,
      files: this.#filesOf(process),
      cpuLimit: limit,
      clockLimit: limit,
      memoryLimit: this.limits.memoryBytes,
      procLimit: this.limits.processes,
      copyIn,
    };
  }

  #filesOf(process: Script | Shell): readonly SandboxFile[] {
    const outputBytes = this.limits.outputBytes;
    const files = [
      { content: process.stdin ?? "" },
      { name: "stdout", max: outputBytes },
      { name: "stderr", max: outputBytes },
    ];
    const entering = process.kind === "shell" && process.directory !== null;

    if (!entering) return files;

    return files.concat({ name: SandboxGateway.DIRECTORY, max: 1024 });
  }

  #outcomeOf(run: SandboxRun): ProcessOutcome {
    if (run.kind === "refused")
      return {
        kind: "unstarted",
        detail: `The sandbox refused the process: ${run.detail}`,
      };

    return this.#resultOf(run.result);
  }

  #resultOf(result: SandboxResult): ProcessOutcome {
    const stdout = result.files.stdout ?? "";
    const stderr = result.files.stderr ?? "";
    const unentered = result.files[SandboxGateway.DIRECTORY] ?? "";

    if (unentered !== "")
      return {
        kind: "unstarted",
        detail: `The working directory could not be entered: ${unentered.trim()}`,
      };

    switch (result.status) {
      case "Accepted":
      case "Nonzero Exit Status":
        return { kind: "exited", code: result.exitStatus, stdout, stderr };
      case "Time Limit Exceeded":
        return { kind: "expired" };
      case "Signalled": {
        const shellCodeOfSignal = 128 + result.exitStatus;
        return { kind: "exited", code: shellCodeOfSignal, stdout, stderr };
      }
      case "Memory Limit Exceeded":
      case "Output Limit Exceeded":
        return {
          kind: "killed",
          detail: `The sandbox stopped the process: ${result.status}`,
        };
      default:
        return {
          kind: "unstarted",
          detail: `The sandbox could not run the process: ${result.status}`,
        };
    }
  }
}
