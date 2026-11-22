import { Injectable } from "@nestjs/common";
import type {
  AsyncApiInboundMessage,
  AsyncApiRequest,
  CloudEvent,
  Failure,
  Effect,
  EffectOutcome,
  EmitOutcome,
  JsonObject as ProtocolObject,
} from "interpreter";
import { EmitEvent } from "../../application/automation/events/emit-event.js";
import { AnswerChildren } from "../../application/automation/instances/answer-children.js";
import { AnswerReceives } from "../../application/automation/instances/answer-receives.js";
import { BeginRun } from "../../application/automation/instances/begin-run.js";
import { FailRun } from "../../application/automation/instances/fail-run.js";
import type { ReceiverView } from "../../application/automation/instances/interfaces.js";
import { ReceiverQueries } from "../../application/automation/instances/queries.js";
import { ReceiveInbound } from "../../application/automation/instances/receive-inbound.js";
import { RespondToEffect } from "../../application/automation/instances/respond-to-effect.js";
import { StartSubWorkflow } from "../../application/automation/instances/start-sub-workflow.js";
import { SecretQueries } from "../../application/automation/secrets/queries.js";
import {
  InboundKind,
  TriggerKind,
  WaitKind,
} from "../../domain/automation/instances/enums.js";
import type {
  InboundMessage,
  RunAgenda,
} from "../../domain/automation/instances/interfaces.js";
import type { JsonObject } from "../../domain/automation/interfaces.js";
import { WorkflowName } from "../../domain/automation/workflows/workflow-name.js";
import type {
  ChildEffect,
  ChildStart,
  Receiver,
  RunAgendaView,
  TimeAnswer,
  TimedWait,
} from "./interfaces.js";

@Injectable()
export class RunController {
  private static readonly LATEST = "latest";
  private static readonly ENDED: RunAgendaView = {
    ended: true,
    calls: [],
    processes: [],
    detached: [],
    children: [],
    receives: [],
    waits: [],
  };

  constructor(
    private readonly beginRun: BeginRun,
    private readonly respondToEffect: RespondToEffect,
    private readonly failRun: FailRun,
    private readonly emitEvent: EmitEvent,
    private readonly startSubWorkflow: StartSubWorkflow,
    private readonly answerReceives: AnswerReceives,
    private readonly answerChildren: AnswerChildren,
    private readonly receiveInbound: ReceiveInbound,
    private readonly receivers: ReceiverQueries,
    private readonly secrets: SecretQueries,
  ) {}

  async begin(instanceId: string, signal: AbortSignal): Promise<RunAgendaView> {
    const begun = await this.beginRun.execute({ instanceId, signal });

    if (!begun.ok) return RunController.ENDED;

    return this.#viewOf(begun.value);
  }

  async respond(
    instanceId: string,
    effectId: string,
    outcome: EffectOutcome,
    signal: AbortSignal,
  ): Promise<RunAgendaView> {
    const answered = outcome as unknown as JsonObject;
    const answer = { effectId, outcome: answered };
    const responded = await this.respondToEffect.execute({
      instanceId,
      answer,
      signal,
    });

    if (!responded.ok) return RunController.ENDED;

    return this.#viewOf(responded.value);
  }

  async received(
    instanceId: string,
    signal: AbortSignal,
  ): Promise<RunAgendaView> {
    const answered = await this.answerReceives.execute({ instanceId, signal });

    if (!answered.ok) return RunController.ENDED;

    return this.#viewOf(answered.value);
  }

  async childrenEnded(
    instanceId: string,
    signal: AbortSignal,
  ): Promise<RunAgendaView> {
    const answered = await this.answerChildren.execute({ instanceId, signal });

    if (!answered.ok) return RunController.ENDED;

    return this.#viewOf(answered.value);
  }

  async openReceivers(): Promise<readonly Receiver[]> {
    const open = await this.receivers.open();
    return open.map((receiver) => this.#receiverOf(receiver));
  }

  async receive(
    instanceId: string,
    execution: string,
    message: AsyncApiInboundMessage,
    fence: number,
  ): Promise<boolean> {
    const received = message as InboundMessage;
    const inbound = { kind: InboundKind.Message as const, message: received };
    const taken = await this.receiveInbound.execute({
      instanceId,
      execution,
      inbound,
      fence,
    });
    return taken.ok;
  }

  async failReceive(
    instanceId: string,
    execution: string,
    failed: Failure,
    fence: number,
  ): Promise<boolean> {
    const failure = failed as unknown as JsonObject;
    const inbound = { kind: InboundKind.Failure as const, failure };
    const taken = await this.receiveInbound.execute({
      instanceId,
      execution,
      inbound,
      fence,
    });
    return taken.ok;
  }

  demands(instanceId: string, execution: string): Promise<boolean> {
    return this.receivers.demands(instanceId, execution);
  }

  fail(instanceId: string): Promise<void> {
    return this.failRun.execute({ instanceId });
  }

  async secretsOf(instanceId: string): Promise<ProtocolObject> {
    const secrets = await this.secrets.ofInstance(instanceId);
    return secrets.values as ProtocolObject;
  }

  async emit(instanceId: string, event: CloudEvent): Promise<EmitOutcome> {
    const cloudEvent = event as JsonObject;
    await this.emitEvent.execute({ instanceId, cloudEvent });
    return { kind: "emitted" };
  }

  async startChild(
    instanceId: string,
    effect: ChildEffect,
  ): Promise<ChildStart> {
    const name = new WorkflowName(effect.namespace, effect.name);
    const latest = effect.version === RunController.LATEST;
    const version = latest ? null : effect.version;
    const trigger = effect.await ? TriggerKind.Parent : TriggerKind.Detached;
    const started = await this.startSubWorkflow.execute({
      parentId: instanceId,
      effectId: effect.id,
      name,
      version,
      input: effect.input,
      trigger,
    });

    if (!started.ok) return { kind: "missing" };

    return { kind: "started", instanceId: started.value.instanceId };
  }

  #viewOf(agenda: RunAgenda): RunAgendaView {
    if (agenda.ended) return RunController.ENDED;

    const awaited = agenda.awaited;
    const waits = awaited
      .filter((effect) => effect.wait !== null)
      .map((effect) => this.#effectOf(effect.request))
      .map((effect) => this.#timedOf(effect))
      .filter((wait) => wait.answers.length > 0);
    const children = awaited
      .filter((effect) => effect.wait?.kind === WaitKind.Child)
      .map((effect) => this.#childOf(effect.request));
    const performed = awaited
      .filter((effect) => effect.wait === null)
      .map((effect) => this.#effectOf(effect.request));
    const detached = performed.filter((effect) => this.#isDetached(effect));
    const processes = performed.filter((effect) => this.#isAwaited(effect));
    const calls = performed.filter((effect) => effect.kind !== "process");
    const receives = awaited
      .filter((effect) => effect.wait?.kind === WaitKind.Message)
      .map((effect) => effect.id);
    return {
      ended: false,
      calls,
      processes,
      detached,
      children,
      receives,
      waits,
    };
  }

  #timedOf(effect: Effect): TimedWait {
    const deadline = effect.deadline;
    const expiry =
      deadline === null ? [] : [this.#answerAt(deadline, "expired")];
    return {
      id: effect.id,
      answers: expiry.concat(this.#ownAnswersOf(effect)),
    };
  }

  #ownAnswersOf(effect: Effect): readonly TimeAnswer[] {
    if (effect.kind === "timer")
      return [this.#answerAt(effect.until, "elapsed")];

    if (effect.kind !== "asyncapi" || effect.exchange.kind !== "receive")
      return [];

    const closesAt = effect.exchange.closesAt;

    if (closesAt === null) return [];

    return [this.#answerAt(closesAt, "closed")];
  }

  #answerAt(at: number, kind: "expired" | "elapsed" | "closed"): TimeAnswer {
    return { at, outcome: { kind } };
  }

  #receiverOf(view: ReceiverView): Receiver {
    const request = view.request as unknown as AsyncApiRequest;
    const closesAt = view.closesAt?.getTime() ?? null;
    return {
      instanceId: view.instanceId,
      execution: view.execution,
      request,
      closesAt,
    };
  }

  #effectOf(request: JsonObject): Effect {
    return request as unknown as Effect;
  }

  #childOf(request: JsonObject): ChildEffect {
    return request as unknown as ChildEffect;
  }

  #isDetached(effect: Effect): boolean {
    return effect.kind === "process" && !effect.await;
  }

  #isAwaited(effect: Effect): boolean {
    return effect.kind === "process" && effect.await;
  }
}
