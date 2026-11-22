import { Injectable } from "@nestjs/common";
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
import { PermanentFault } from "../../domain/errors.js";
import type { CallContext } from "./interfaces.js";

@Injectable()
export class EffectPerformer implements EffectClient {
  constructor(
    private readonly http: HttpClient,
    private readonly grpc: GrpcClient,
    private readonly mcp: McpClient,
    private readonly a2a: A2aClient,
    private readonly asyncApi: AsyncApiClient,
    private readonly sandbox: SandboxClient,
  ) {}

  async perform(effect: Effect, step: StepCall): Promise<EffectOutcome> {
    const remaining =
      effect.deadline === null ? null : effect.deadline - Date.now();

    if (remaining !== null && remaining <= 0) return { kind: "expired" };

    const context = this.#contextOf(step, remaining);
    const outcome = await this.#performed(effect, context);
    step.signal.throwIfAborted();
    return outcome;
  }

  async performDetached(
    request: SandboxedProcessRequest,
    step: StepCall,
  ): Promise<void> {
    const context = this.#contextOf(step, null);
    await this.sandbox.run(request, context);
    step.signal.throwIfAborted();
  }

  #contextOf(step: StepCall, remaining: number | null): CallContext {
    const longestTimer = 2 ** 31 - 1;
    const timed = remaining !== null && remaining <= longestTimer;
    const signals = timed
      ? [step.signal, AbortSignal.timeout(Math.ceil(remaining))]
      : [step.signal];
    const signal = AbortSignal.any(signals);
    return {
      idempotencyKey: step.idempotencyKey,
      signal,
      secrets: step.secrets,
      remaining,
    };
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
    if (!this.#overHttp(effect)) throw this.#unperformable("mcp.stdio");

    return this.mcp.call(effect, context);
  }

  #process(
    effect: Effect & ProcessRequest,
    context: CallContext,
  ): Promise<EffectOutcome> {
    if (!this.#isSandboxed(effect))
      throw this.#unperformable("process.container");

    return this.sandbox.run(effect, context);
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
