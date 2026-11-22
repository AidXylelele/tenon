import type { HttpClient as NestHttpClient } from "@nestjs/http-client";
import {
  type ResiliencePolicy,
  type ResilienceService,
  ResilienceTimeoutError,
} from "@nestjs/resilience";
import type { ProcessOutcome, Script, Shell } from "interpreter";
import type { ShellSupport } from "../../application/automation/host/interfaces.js";
import type { ProcessPlatform } from "../../application/automation/host/queries.js";
import type { FetchedText } from "../http-client/interfaces.js";
import type { HttpClient } from "../http-client/http.client.js";
import type { CallContext } from "../workflows/interfaces.js";
import type {
  BuiltCommand,
  SandboxCommand,
  SandboxedProcessRequest,
  SandboxFile,
  SandboxResult,
  ScriptLanguage,
} from "./interfaces.js";
import { JavaScript } from "./javascript.js";
import { Python } from "./python.js";
import type { SandboxLimits } from "./sandbox-limits.js";
import { SANDBOX_REFUSAL, SANDBOX_RESULTS } from "./sandbox-result.schema.js";
import shellPlatform from "./shell-platform.json" with { type: "json" };

const DIRECTORY = "directory";

export class SandboxClient implements ProcessPlatform {
  private readonly policy: ResiliencePolicy;
  private readonly languages: Readonly<
    Record<Script["language"], ScriptLanguage>
  > = { js: new JavaScript(), python: new Python() };

  constructor(
    private readonly sandbox: NestHttpClient,
    private readonly http: HttpClient,
    private readonly limits: SandboxLimits,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("processes");
  }

  async run(
    request: SandboxedProcessRequest,
    context: CallContext,
  ): Promise<ProcessOutcome> {
    const built = await this.#commandOf(request.process, context);

    if (built.kind !== "command") return built;

    try {
      return await this.policy.execute(
        (attempt) => this.#ran(built.command, attempt.signal),
        { signal: context.signal },
      );
    } catch (error) {
      return this.#failureOf(error, context.signal);
    }
  }

  shell(): ShellSupport {
    return shellPlatform;
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
    const line = this.#shellLineOf(shell);
    const args = [shellPlatform.shell, "-c", line, "sh"].concat(
      shell.arguments,
    );
    const command = this.#sandboxCommandOf(args, {}, shell, remaining);
    return { kind: "command", command };
  }

  #shellLineOf(shell: Shell): string {
    if (shell.directory === null) return shell.command;

    const directory = this.#quoted(shell.directory);
    return `cd -- ${directory} 2>&3 || exit\nexec 3>&-\n${shell.command}`;
  }

  async #scriptCommandOf(
    script: Script,
    context: CallContext,
  ): Promise<BuiltCommand> {
    const code = await this.#codeOf(script, context);

    if (code.kind !== "text") return code;

    const language = this.languages[script.language];
    const names = Object.keys(script.arguments);

    if (!names.every((name) => language.declares(name)))
      return {
        kind: "misconfigured",
        detail:
          "An argument of the script is not a variable name of its language",
      };

    const declarations = names.map((name) =>
      language.declarationOf(name, script.arguments[name] ?? null),
    );
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

    return this.http.text(script.source, context);
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

    return files.concat({ name: DIRECTORY, max: 1024 });
  }

  async #ran(
    command: SandboxCommand,
    signal: AbortSignal,
  ): Promise<ProcessOutcome> {
    const response = await this.sandbox.post("/run", {
      json: { cmd: [command] },
      signal,
    });
    const status = response.status;
    const refusal = SANDBOX_REFUSAL.safeParse(response.data);

    if ((status === 400 || status === 404) && refusal.success)
      return {
        kind: "unstarted",
        detail: `The sandbox refused the process: ${refusal.data}`,
      };

    const results = SANDBOX_RESULTS.safeParse(response.data);

    if (!response.ok || !results.success)
      throw new Error(
        `The sandbox answered other than with a result, status ${String(status)}`,
      );

    return this.#outcomeOf(results.data[0]);
  }

  #outcomeOf(result: SandboxResult): ProcessOutcome {
    const stdout = result.files.stdout ?? "";
    const stderr = result.files.stderr ?? "";
    const unentered = result.files[DIRECTORY] ?? "";

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

  #failureOf(error: unknown, signal: AbortSignal): ProcessOutcome {
    if (signal.aborted || error instanceof ResilienceTimeoutError)
      return { kind: "expired" };

    throw error;
  }

  #quoted(text: string): string {
    const escaped = text.replaceAll("'", `'\\''`);
    return `'${escaped}'`;
  }
}
