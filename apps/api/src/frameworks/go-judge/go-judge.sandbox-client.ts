import { Injectable } from "@nestjs/common";
import {
  InjectHttpClient,
  HttpClient as NestHttpClient,
} from "@nestjs/http-client";
import {
  type ResiliencePolicy,
  ResilienceService,
  ResilienceTimeoutError,
} from "@nestjs/resilience";
import type {
  SandboxClient,
  SandboxCommand,
  SandboxRun,
} from "../../interface-adapters/sandbox/interfaces.js";
import { HttpClientName } from "../http/enums.js";
import { TransportFaults } from "../http/transport-faults.js";
import { SANDBOX_REFUSAL, SANDBOX_RESULTS } from "./sandbox-result.schema.js";

@Injectable()
export class GoJudgeSandboxClient implements SandboxClient {
  private readonly policy: ResiliencePolicy;

  constructor(
    @InjectHttpClient(HttpClientName.Sandbox)
    private readonly sandbox: NestHttpClient,
    private readonly faults: TransportFaults,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("processes");
  }

  async run(command: SandboxCommand, signal: AbortSignal): Promise<SandboxRun> {
    try {
      return await this.policy.execute(
        (attempt) => this.#ran(command, attempt.signal),
        { signal },
      );
    } catch (error) {
      const expired = signal.aborted || error instanceof ResilienceTimeoutError;

      if (expired) throw this.faults.expired();

      throw error;
    }
  }

  async #ran(
    command: SandboxCommand,
    signal: AbortSignal,
  ): Promise<SandboxRun> {
    const response = await this.sandbox.post("/run", {
      json: { cmd: [command] },
      signal,
    });
    const status = response.status;
    const refusal = SANDBOX_REFUSAL.safeParse(response.data);
    const refused = (status === 400 || status === 404) && refusal.success;

    if (refused) return { kind: "refused", detail: refusal.data };

    const results = SANDBOX_RESULTS.safeParse(response.data);
    const answered = response.ok && results.success;

    if (!answered) {
      const code = String(status);
      throw new Error(
        `The sandbox answered other than with a result, status ${code}`,
      );
    }

    return { kind: "ran", result: results.data[0] };
  }
}
