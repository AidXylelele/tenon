import { ErrorCodes, ResponseError } from "vscode-languageserver/browser";
import type { Phase } from "./interfaces.js";

export class Lifecycle {
  readonly #log: (line: string) => void;
  #phase: Phase = "starting";

  constructor(log: (line: string) => void) {
    this.#log = log;
  }

  get phase(): Phase {
    return this.#phase;
  }

  begin(): void {
    this.#phase = "initializing";
  }

  run(): void {
    this.#phase = "running";
  }

  fail(reason: string): void {
    this.#phase = "failed";
    this.#log(reason);
  }

  shutDown(): void {
    this.#phase = "shutDown";
  }

  refusal(): ResponseError {
    switch (this.#phase) {
      case "starting":
      case "initializing":
      case "failed":
        return new ResponseError(
          ErrorCodes.ServerNotInitialized,
          "The language server is not initialized.",
        );
      case "shutDown":
        return new ResponseError(
          ErrorCodes.InvalidRequest,
          "The language server has shut down.",
        );
      case "running":
        return new ResponseError(
          ErrorCodes.MethodNotFound,
          "The language server has no such method.",
        );
    }
  }

  guarded<Params, Result>(
    handler: (params: Params) => Result,
  ): (params: Params) => Result | ResponseError {
    return (params) => {
      const isRunning = this.#phase === "running";

      if (!isRunning) {
        return this.refusal();
      }

      try {
        return handler(params);
      } catch (fault) {
        this.#report(fault);
        return new ResponseError(
          ErrorCodes.InternalError,
          "The request failed inside the language server.",
        );
      }
    };
  }

  contained<Argument>(
    step: (argument: Argument) => void,
  ): (argument: Argument) => void {
    return (argument) => {
      const isRunning = this.#phase === "running";

      if (!isRunning) {
        return;
      }

      try {
        step(argument);
      } catch (fault) {
        this.#report(fault);
      }
    };
  }

  #report(fault: unknown): void {
    const stack = fault instanceof Error ? fault.stack : undefined;
    const hasStack = stack !== undefined;

    if (hasStack) {
      this.#log(stack);
      return;
    }

    const line = String(fault);
    this.#log(line);
  }
}
