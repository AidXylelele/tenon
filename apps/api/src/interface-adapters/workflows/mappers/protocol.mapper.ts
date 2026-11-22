import { Injectable } from "@nestjs/common";
import type {
  CloudEvent,
  EffectOutcome,
  EffectResponse,
  JsonObject as ProtocolObject,
  JsonValue as ProtocolValue,
} from "interpreter";
import type { Receipt } from "../../../application/automation/instances/interfaces.js";
import { WorkflowQueries } from "../../../application/automation/workflows/queries.js";
import {
  InboundKind,
  Phase,
} from "../../../domain/automation/instances/enums.js";
import type { EffectAnswer } from "../../../domain/automation/instances/interfaces.js";
import type { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import type {
  JsonObject,
  JsonValue,
} from "../../../domain/automation/interfaces.js";
import type { JsonOf, ProgramCall, ProgramSource } from "../interfaces.js";

@Injectable()
export class ProtocolMapper {
  private static readonly MESSAGE = "message";

  constructor(private readonly workflows: WorkflowQueries) {}

  toObject(value: JsonObject): ProtocolObject {
    const members = Object.entries(value).flatMap(([key, item]) =>
      item === undefined ? [] : [[key, this.toValue(item)] as const],
    );
    return Object.fromEntries(members);
  }

  toValue(value: JsonValue): ProtocolValue {
    if (this.#isList(value)) return value.map((item) => this.toValue(item));

    if (typeof value !== "object" || value === null) return value;

    return this.toObject(value);
  }

  toCloudEvent(event: JsonObject): CloudEvent {
    const attributes = this.toObject(event);
    const specversion = this.#attributeOf(attributes, "specversion");
    const id = this.#attributeOf(attributes, "id");
    const source = this.#attributeOf(attributes, "source");
    const type = this.#attributeOf(attributes, "type");
    return { ...attributes, specversion, id, source, type };
  }

  toCloudEvents(input: JsonValue): readonly CloudEvent[] {
    if (!this.#isList(input)) return [];

    return input.map((event) => this.#cloudEventIn(event));
  }

  toResponse(answer: EffectAnswer): EffectResponse {
    const outcome = answer.outcome as JsonOf<EffectOutcome>;
    return { id: answer.effectId, outcome };
  }

  toReceivedAnswer(receipt: Receipt): EffectAnswer {
    const outcome = this.#receivedOutcomeOf(receipt);
    return { effectId: receipt.wait.effectId, outcome };
  }

  toChildAnswer(child: WorkflowInstance): EffectAnswer {
    const effectId = child.originEffectId;

    if (effectId === null)
      throw new TypeError("The instance awaits no effect of its parent");

    const outcome = this.#childOutcomeOf(child);
    return { effectId, outcome };
  }

  toCall(
    versionId: string,
    fingerprint: string | null,
    signal: AbortSignal | null,
  ): ProgramCall {
    const source = () => this.#sourceOf(versionId);
    return { versionId, fingerprint, source, signal };
  }

  async #sourceOf(versionId: string): Promise<ProgramSource> {
    const program = await this.workflows.programById(versionId);

    if (program === null)
      throw new TypeError(`The version ${versionId} is gone`);

    const document = this.toObject(program.document);
    return { document, imports: program.imports, secrets: program.secrets };
  }

  #attributeOf(attributes: ProtocolObject, name: string): string {
    const value = attributes[name];

    if (typeof value !== "string")
      throw new TypeError(`The event has no ${name} attribute`);

    return value;
  }

  #cloudEventIn(value: JsonValue): CloudEvent {
    if (typeof value !== "object" || value === null || this.#isList(value))
      throw new TypeError("The input holds a value that is not an event");

    return this.toCloudEvent(value);
  }

  #receivedOutcomeOf(receipt: Receipt): JsonObject {
    const inbound = receipt.inbound;

    switch (inbound.kind) {
      case InboundKind.Message:
        return {
          kind: ProtocolMapper.MESSAGE,
          message: {
            payload: inbound.message.payload,
            headers: inbound.message.headers,
            correlationId: inbound.message.correlationId,
          },
        };
      case InboundKind.Failure:
        return inbound.failure;
    }
  }

  #childOutcomeOf(child: WorkflowInstance): JsonObject {
    switch (child.phase) {
      case Phase.Completed:
        return { kind: "completed", output: child.run?.output ?? null };
      case Phase.Faulted:
        return { kind: "faulted", error: child.run?.error ?? child.error };
      case Phase.Cancelled:
        return { kind: "cancelled" };
      case Phase.Pending:
      case Phase.Running:
      case Phase.Waiting:
      case Phase.Suspended:
        throw new TypeError("The child has not ended");
    }
  }

  #isList(value: JsonValue): value is readonly JsonValue[] {
    return Array.isArray(value);
  }
}
