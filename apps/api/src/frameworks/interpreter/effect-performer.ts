import { Injectable } from "@nestjs/common";
import { type Histogram, metrics, trace } from "@opentelemetry/api";
import type {
  Effect,
  EffectOutcome,
  McpRequest,
  ProcessRequest,
} from "interpreter";
import type {
  EffectClient,
  SandboxedProcessRequest,
  StepCall,
} from "../../interface-adapters/workflows/interfaces.js";
import { A2aClient } from "../a2a/a2a.client.js";
import { AsyncApiClient } from "../asyncapi/asyncapi.client.js";
import { SandboxClient } from "../go-judge/sandbox.client.js";
import { GrpcClient } from "../grpc/grpc.client.js";
import { HttpClient } from "../http-client/http.client.js";
import type { HttpMcpRequest } from "../mcp/interfaces.js";
import { McpClient } from "../mcp/mcp.client.js";
import { Instrumentation } from "../opentelemetry/enums.js";
import { effectDurationBoundaries } from "../opentelemetry/histogram.presets.js";
import { PermanentFault } from "../../interface-adapters/workflows/permanent-fault.error.js";
import type { CallContext } from "./interfaces.js";

@Injectable()
export class EffectPerformer implements EffectClient {
  private static readonly OTHER_ERROR = "_OTHER";
  private static readonly LONGEST_TIMER = 2 ** 31 - 1;

  readonly #duration: Histogram;

  constructor(
    private readonly http: HttpClient,
    private readonly grpc: GrpcClient,
    private readonly mcp: McpClient,
    private readonly a2a: A2aClient,
    private readonly asyncApi: AsyncApiClient,
    private readonly sandbox: SandboxClient,
  ) {
    const meter = metrics.getMeter(Instrumentation.Scope);
    this.#duration = meter.createHistogram("tenon.effect.duration", {
      unit: "s",
      description: "The time an effect takes to perform.",
      advice: { explicitBucketBoundaries: effectDurationBoundaries },
    });
  }

  async perform(effect: Effect, step: StepCall): Promise<EffectOutcome> {
    const left = effect.deadline === null ? null : effect.deadline - Date.now();

    if (left !== null && left <= 0) return { kind: "expired" };

    const context = this.#contextOf(step, left);
    const outcome = await this.#measured(effect.kind, () =>
      this.#performed(effect, context),
    );
    step.signal.throwIfAborted();
    return outcome;
  }

  async performDetached(
    request: SandboxedProcessRequest,
    step: StepCall,
  ): Promise<void> {
    const context = this.#contextOf(step, null);
    await this.#measured(request.kind, () =>
      this.sandbox.run(request, context),
    );
    step.signal.throwIfAborted();
  }

  sandboxed(effect: Effect): SandboxedProcessRequest {
    const contained = this.#isSandboxed(effect);

    if (!contained) throw this.#unperformable("process.container");

    return effect;
  }

  async #measured(
    kind: string,
    work: () => Promise<EffectOutcome>,
  ): Promise<EffectOutcome> {
    const active = trace.getActiveSpan();
    active?.setAttribute("tenon.effect.kind", kind);
    const started = performance.now();

    try {
      const outcome = await work();
      const attributes = {
        "tenon.effect.kind": kind,
        "tenon.effect.outcome": outcome.kind,
      };
      this.#recorded(started, attributes);
      return outcome;
    } catch (error) {
      const attributes = {
        "tenon.effect.kind": kind,
        "error.type": this.#errorTypeOf(error),
      };
      this.#recorded(started, attributes);
      throw error;
    }
  }

  #recorded(started: number, attributes: Record<string, string>): void {
    const seconds = (performance.now() - started) / 1000;
    this.#duration.record(seconds, attributes);
  }

  #errorTypeOf(error: unknown): string {
    if (error instanceof Error) return error.name;

    return EffectPerformer.OTHER_ERROR;
  }

  #contextOf(step: StepCall, left: number | null): CallContext {
    const remaining =
      left === null ? null : Math.min(left, EffectPerformer.LONGEST_TIMER);
    const signal = this.#signalOf(step.signal, remaining);
    return {
      idempotencyKey: step.idempotencyKey,
      signal,
      secrets: step.secrets,
      remaining,
    };
  }

  #signalOf(stepped: AbortSignal, remaining: number | null): AbortSignal {
    if (remaining === null) return stepped;

    const milliseconds = Math.ceil(remaining);
    const expired = AbortSignal.timeout(milliseconds);
    return AbortSignal.any([stepped, expired]);
  }

  #performed(effect: Effect, context: CallContext): Promise<EffectOutcome> {
    switch (effect.kind) {
      case "http":
        return this.http.send(effect, context);
      case "openapi":
        return this.http.call(effect, context);
      case "resource":
        return this.http.read(effect, context);
      case "grpc":
        return this.grpc.call(effect, context);
      case "a2a":
        return this.a2a.call(effect, context);
      case "asyncapi":
        return this.asyncApi.publish(effect, context);
      case "mcp":
        return this.#mcp(effect, context);
      case "process":
        return this.#process(effect, context);
      case "emit":
      case "workflow":
      case "timer":
      case "listen":
        throw this.#unperformable(effect.kind);
    }
  }

  #mcp(
    effect: Effect & McpRequest,
    context: CallContext,
  ): Promise<EffectOutcome> {
    const overHttp = this.#overHttp(effect);

    if (!overHttp) throw this.#unperformable("mcp.stdio");

    return this.mcp.call(effect, context);
  }

  #process(
    effect: Effect & ProcessRequest,
    context: CallContext,
  ): Promise<EffectOutcome> {
    const request = this.sandboxed(effect);
    return this.sandbox.run(request, context);
  }

  #unperformable(capability: string): PermanentFault {
    return new PermanentFault(
      `The host does not perform '${capability}'; its profile refuses it at publish`,
    );
  }

  #overHttp(request: McpRequest): request is HttpMcpRequest {
    return request.transport.kind === "http";
  }

  #isSandboxed(effect: Effect): effect is Effect & SandboxedProcessRequest {
    return effect.kind === "process" && effect.process.kind !== "container";
  }
}
