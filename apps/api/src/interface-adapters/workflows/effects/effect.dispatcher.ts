import { Injectable } from "@nestjs/common";
import type { Effect, EffectOutcome } from "interpreter";
import type { EffectCall } from "../../../application/automation/instances/interfaces.js";
import type { EffectClient } from "../../../application/automation/instances/ports.js";
import type { JsonObject } from "../../../domain/automation/interfaces.js";
import type {
  JsonOf,
  SandboxedProcessRequest,
  StepCall,
} from "../interfaces.js";
import { ProtocolMapper } from "../mappers/protocol.mapper.js";
import { A2aGateway } from "./a2a.gateway.js";
import { AsyncApiGateway } from "./asyncapi.gateway.js";
import { GrpcGateway } from "./grpc.gateway.js";
import { HttpGateway } from "./http.gateway.js";
import type { CallContext } from "./interfaces.js";
import { McpGateway } from "./mcp.gateway.js";
import { OpenApiGateway } from "./openapi.gateway.js";
import { ResourceGateway } from "./resource.gateway.js";
import { SandboxGateway } from "./sandbox.gateway.js";

@Injectable()
export class EffectDispatcher implements EffectClient {
  private static readonly LONGEST_TIMER = 2 ** 31 - 1;

  constructor(
    private readonly http: HttpGateway,
    private readonly openApi: OpenApiGateway,
    private readonly resource: ResourceGateway,
    private readonly grpc: GrpcGateway,
    private readonly mcp: McpGateway,
    private readonly a2a: A2aGateway,
    private readonly asyncApi: AsyncApiGateway,
    private readonly sandbox: SandboxGateway,
    private readonly protocol: ProtocolMapper,
  ) {}

  async perform(request: JsonObject, call: EffectCall): Promise<JsonObject> {
    const effect = this.#effectOf(request);
    const step = this.#stepOf(call);
    const outcome: JsonOf<EffectOutcome> = await this.#outcomeOf(effect, step);
    return outcome;
  }

  async performDetached(request: JsonObject, call: EffectCall): Promise<void> {
    const effect = this.#effectOf(request);
    const process = this.#sandboxed(effect);
    const step = this.#stepOf(call);
    const context = this.#contextOf(step, null);
    await this.sandbox.perform(process, context);
    step.signal.throwIfAborted();
  }

  async #outcomeOf(effect: Effect, step: StepCall): Promise<EffectOutcome> {
    const left = effect.deadline === null ? null : effect.deadline - Date.now();
    const expired = left !== null && left <= 0;

    if (expired) return { kind: "expired" };

    const context = this.#contextOf(step, left);
    const outcome = await this.#performed(effect, context);
    step.signal.throwIfAborted();
    return outcome;
  }

  #effectOf(request: JsonObject): Effect {
    return request as JsonOf<Effect>;
  }

  #stepOf(call: EffectCall): StepCall {
    const secrets = this.protocol.toObject(call.secrets.values);
    const idempotencyKey = `${call.instanceId}:${call.effectId}`;
    return {
      idempotencyKey,
      signal: call.signal,
      secrets,
    };
  }

  #sandboxed(effect: Effect): SandboxedProcessRequest {
    const contained = this.#isSandboxed(effect);

    if (!contained) throw this.#unperformable("process.container");

    return effect;
  }

  #contextOf(step: StepCall, left: number | null): CallContext {
    const remaining =
      left === null ? null : Math.min(left, EffectDispatcher.LONGEST_TIMER);
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
        return this.http.perform(effect, context);
      case "openapi":
        return this.openApi.perform(effect, context);
      case "resource":
        return this.resource.perform(effect, context);
      case "grpc":
        return this.grpc.perform(effect, context);
      case "mcp":
        return this.mcp.perform(effect, context);
      case "a2a":
        return this.a2a.perform(effect, context);
      case "asyncapi":
        return this.asyncApi.perform(effect, context);
      case "process": {
        const request = this.#sandboxed(effect);
        return this.sandbox.perform(request, context);
      }
      case "emit":
      case "workflow":
      case "timer":
      case "listen":
        throw this.#unperformable(effect.kind);
    }
  }

  #unperformable(capability: string): Error {
    return new Error(
      `The host does not perform '${capability}'; its profile refuses it at publish`,
    );
  }

  #isSandboxed(effect: Effect): effect is Effect & SandboxedProcessRequest {
    return effect.kind === "process" && effect.process.kind !== "container";
  }
}
