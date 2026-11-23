import { Injectable } from "@nestjs/common";
import type {
  CloudEvent,
  Effect,
  EffectResponse,
  HostEnd,
  StartContext,
  State,
  Step,
  StepContext,
} from "interpreter";
import type { AcceptedEvent } from "../../../application/automation/events/interfaces.js";
import type {
  InputProblem,
  Receipt,
} from "../../../application/automation/instances/interfaces.js";
import type { WorkflowRuntime } from "../../../application/automation/instances/ports.js";
import type { VersionIdentity } from "../../../application/automation/workflows/interfaces.js";
import { WorkflowQueries } from "../../../application/automation/workflows/queries.js";
import {
  TriggerKind,
  TurnStatus,
} from "../../../domain/automation/instances/enums.js";
import type {
  EffectAnswer,
  EventOffer,
  Listening,
  PlayedTurn,
  RunEnding,
  RunTurn,
} from "../../../domain/automation/instances/interfaces.js";
import type { Run } from "../../../domain/automation/instances/run.js";
import type { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import type { JsonValue } from "../../../domain/automation/interfaces.js";
import type { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import type { WorkflowVersion } from "../../../domain/automation/workflows/workflow-version.js";
import {
  type ControlStep,
  InterpreterClient,
  type Played,
  type Program,
  type ProgramCall,
} from "../interfaces.js";
import { ProtocolMapper } from "../mappers/protocol.mapper.js";
import { RunTurnMapper } from "../mappers/run-turn.mapper.js";
import { ProgramCalls } from "../program-calls.js";

@Injectable()
export class InterpreterRuntimeGateway implements WorkflowRuntime {
  private static readonly TRIAL = "trial";
  private static readonly ROOT_EXECUTION = "";
  private static readonly PLATFORM_FAILURE =
    "The platform could not run the instance";

  constructor(
    private readonly client: InterpreterClient,
    private readonly workflows: WorkflowQueries,
    private readonly calls: ProgramCalls,
    private readonly protocol: ProtocolMapper,
    private readonly turns: RunTurnMapper,
  ) {}

  async begin(
    instance: WorkflowInstance,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<RunTurn> {
    const call = this.calls.of(instance.versionId, null, signal);
    const context = this.#startContextOf(instance.id, secrets, now);

    if (instance.trigger !== TriggerKind.Event) {
      const input = this.protocol.toValue(instance.input);
      const started = await this.client.start(call, input, context);
      const played = { steps: [started.step], answered: [], taken: null };
      const program = { call, fingerprint: started.fingerprint, awaited: [] };
      return this.turns.toTurn(program, played, []);
    }

    const correlated = await this.client.correlate(call, context);
    const events = this.protocol.toCloudEvents(instance.input);
    const played = await this.#correlated(
      call,
      context,
      correlated.step,
      events,
    );
    const program = { call, fingerprint: correlated.fingerprint, awaited: [] };
    return this.turns.toTurn(program, played, []);
  }

  async respond(
    instance: WorkflowInstance,
    answer: EffectAnswer,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<PlayedTurn> {
    const run = this.#runOf(instance);
    const program = this.#programOf(instance, run, signal);
    const state = this.turns.toState(run);
    const context = this.#contextOf(secrets, now);
    const response = this.protocol.toResponse(answer);
    const stepped = await this.client.respond(
      program.call,
      state,
      response,
      context,
    );

    if (stepped.kind === "incompatible") return this.#stranded(instance, now);

    const answered = [answer.effectId];
    const played = { steps: [stepped.step], answered, taken: null };
    const expired = response.outcome.kind === "expired" ? answered : [];
    return this.turns.toTurn(program, played, expired);
  }

  receive(
    instance: WorkflowInstance,
    receipt: Receipt,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<PlayedTurn> {
    const answer = this.protocol.toReceivedAnswer(receipt);
    return this.respond(instance, answer, secrets, now, signal);
  }

  async offer(
    instance: WorkflowInstance,
    offer: EventOffer,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<PlayedTurn> {
    const run = this.#runOf(instance);
    const program = this.#programOf(instance, run, signal);
    const state = this.turns.toState(run);
    const context = this.#contextOf(secrets, now);
    const event = this.protocol.toCloudEvent(offer.event);
    const candidates = run.listeningFor(offer);
    const played = await this.#offeredTo(
      program.call,
      state,
      context,
      event,
      candidates,
    );

    if (played === null) return this.#stranded(instance, now);

    return this.turns.toTurn(program, played, []);
  }

  answerChild(
    parent: WorkflowInstance,
    child: WorkflowInstance,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<PlayedTurn> {
    const answer = this.protocol.toChildAnswer(child);
    return this.respond(parent, answer, secrets, now, signal);
  }

  suspend(
    instance: WorkflowInstance,
    secrets: RunSecrets,
    now: Date,
  ): Promise<PlayedTurn> {
    const context = this.#contextOf(secrets, now);
    return this.#controlled(instance, now, null, (call, state) =>
      this.client.suspend(call, state, context),
    );
  }

  resume(
    instance: WorkflowInstance,
    secrets: RunSecrets,
    now: Date,
  ): Promise<PlayedTurn> {
    const context = this.#contextOf(secrets, now);
    return this.#controlled(instance, now, null, (call, state) =>
      this.client.resume(call, state, context),
    );
  }

  cancel(
    instance: WorkflowInstance,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal | null,
  ): Promise<PlayedTurn> {
    const context = this.#contextOf(secrets, now);
    return this.#controlled(instance, now, signal, (call, state) =>
      this.client.cancel(call, state, context),
    );
  }

  async accepts(
    version: WorkflowVersion,
    event: AcceptedEvent,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<boolean> {
    const call = this.calls.of(version.id, null, signal);
    const trial = InterpreterRuntimeGateway.TRIAL;
    const context = this.#startContextOf(trial, secrets, now);
    const correlated = await this.client.correlate(call, context);
    const offered = this.protocol.toCloudEvent(event.cloudEvent);
    const played = await this.#correlated(call, context, correlated.step, [
      offered,
    ]);
    return played.answered.length > 0;
  }

  inputProblemsOf(
    version: WorkflowVersion,
    input: JsonValue,
  ): Promise<readonly InputProblem[]> {
    const call = this.calls.of(version.id, null, null);
    const value = this.protocol.toValue(input);
    return this.client.inputProblemsOf(call, value);
  }

  async faultedEnding(
    instance: WorkflowInstance,
    now: Date,
  ): Promise<RunEnding> {
    const identity = await this.#identityOf(instance);
    const at = now.getTime();
    const end: HostEnd = {
      identity,
      instance: instance.id,
      now: at,
      phase: "faulted",
      detail: InterpreterRuntimeGateway.PLATFORM_FAILURE,
    };
    return this.#endingOf(end);
  }

  async #stranded(instance: WorkflowInstance, now: Date): Promise<PlayedTurn> {
    const identity = await this.#identityOf(instance);
    const at = now.getTime();
    const end: HostEnd = {
      identity,
      instance: instance.id,
      now: at,
      phase: "cancelled",
    };
    const ending = this.#endingOf(end);
    return { status: TurnStatus.Stranded, ending };
  }

  async #identityOf(instance: WorkflowInstance): Promise<VersionIdentity> {
    const identity = await this.workflows.identityById(instance.versionId);

    if (identity === null)
      throw new TypeError(`The version ${instance.versionId} is gone`);

    return identity;
  }

  #endingOf(end: HostEnd): RunEnding {
    const ending = this.client.ending(end);
    return this.turns.toEnding(ending);
  }

  async #controlled(
    instance: WorkflowInstance,
    now: Date,
    signal: AbortSignal | null,
    control: ControlStep,
  ): Promise<PlayedTurn> {
    const run = this.#runOf(instance);
    const program = this.#programOf(instance, run, signal);
    const state = this.turns.toState(run);
    const stepped = await control(program.call, state);

    if (stepped.kind === "incompatible") return this.#stranded(instance, now);

    const played = { steps: [stepped.step], answered: [], taken: null };
    return this.turns.toTurn(program, played, []);
  }

  async #correlated(
    call: ProgramCall,
    context: StepContext,
    first: Step,
    events: readonly CloudEvent[],
  ): Promise<Played> {
    const steps: Step[] = [first];
    const answered: string[] = [];

    for (const event of events) {
      const listen = this.#triggerListenIn(steps, answered);
      const current = steps[steps.length - 1];

      if (listen === null || current === undefined) break;

      const response: EffectResponse = {
        id: listen.id,
        outcome: { kind: "event", event },
      };
      const stepped = await this.client.respond(
        call,
        current.state,
        response,
        context,
      );

      if (stepped.kind === "incompatible")
        throw new TypeError("A run that has not begun fits every build");

      steps.push(stepped.step);
      const declined = stepped.step.declined.includes(event.id);

      if (!declined) answered.push(listen.id);
    }

    return { steps, answered, taken: null };
  }

  async #offeredTo(
    call: ProgramCall,
    state: State,
    context: StepContext,
    event: CloudEvent,
    candidates: readonly Listening[],
  ): Promise<Played | null> {
    const steps: Step[] = [];
    let current = state;

    for (const candidate of candidates) {
      const response: EffectResponse = {
        id: candidate.effectId,
        outcome: { kind: "event", event },
      };
      const stepped = await this.client.respond(
        call,
        current,
        response,
        context,
      );

      if (stepped.kind === "incompatible") return null;

      steps.push(stepped.step);
      current = stepped.step.state;
      const declined = stepped.step.declined.includes(event.id);

      if (declined) continue;

      const taken = { eventId: event.id, execution: candidate.execution };
      return { steps, answered: [candidate.effectId], taken };
    }

    return { steps, answered: [], taken: null };
  }

  #contextOf(secrets: RunSecrets, now: Date): StepContext {
    const at = now.getTime();
    const values = this.protocol.toObject(secrets.values);
    const runtime = this.client.runtime();
    return { now: at, secrets: values, runtime };
  }

  #startContextOf(
    instanceId: string,
    secrets: RunSecrets,
    now: Date,
  ): StartContext {
    const context = this.#contextOf(secrets, now);
    return {
      now: context.now,
      secrets: context.secrets,
      runtime: context.runtime,
      instance: instanceId,
    };
  }

  #runOf(instance: WorkflowInstance): Run {
    const run = instance.run;

    if (run === null) throw new TypeError("The instance has not begun its run");

    return run;
  }

  #programOf(
    instance: WorkflowInstance,
    run: Run,
    signal: AbortSignal | null,
  ): Program {
    const fingerprint = run.fingerprint;
    const call = this.calls.of(instance.versionId, fingerprint, signal);
    return { call, fingerprint, awaited: run.awaited };
  }

  #triggerListenIn(
    steps: readonly Step[],
    answered: readonly string[],
  ): Effect | null {
    const withdrawn = steps.flatMap((step) => step.withdrawn);
    const requested = steps.flatMap((step) => step.requested);
    const listens = requested.filter((effect) => {
      if (effect.kind !== "listen") return false;

      const dropped = withdrawn.includes(effect.id);
      const met = answered.includes(effect.id);
      const root =
        effect.subscription === InterpreterRuntimeGateway.ROOT_EXECUTION;
      return root && !dropped && !met;
    });
    return listens[0] ?? null;
  }
}
