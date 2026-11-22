import type {
  AnalysisProfile,
  LifecycleEventKind,
} from "../../application/automation/host/interfaces.js";
import type { HostCapabilities } from "../../application/automation/host/queries.js";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { lifecycleEventCatalogue, stateFormatVersion } from "interpreter";
import type {
  AsyncApiRequest,
  CloudEvent,
  Diagnostic,
  Effect,
  EffectOutcome,
  EffectResponse,
  HostEnd,
  JsonObject as ProtocolObject,
  JsonValue as ProtocolValue,
  LifecycleEvent as ProtocolEvent,
  Schedule as ProtocolSchedule,
  StartContext,
  State,
  Step,
  StepContext,
  TaskValue as ProtocolTaskValue,
} from "interpreter";
import type { AcceptedEvent } from "../../application/automation/events/interfaces.js";
import type { EventRouting } from "../../application/automation/events/ports.js";
import type {
  InputProblem,
  Receipt,
} from "../../application/automation/instances/interfaces.js";
import type { WorkflowRuntime } from "../../application/automation/instances/ports.js";
import type { SubscriptionFilters } from "../../application/automation/subscriptions/ports.js";
import { DefinitionRefusal } from "../../application/automation/workflows/enums.js";
import type { DefinitionCompiler } from "../../application/automation/workflows/ports.js";
import type {
  DefinitionFailure,
  DefinitionProblem,
  DefinitionSource,
  VersionIdentity,
} from "../../application/automation/workflows/interfaces.js";
import {
  InboundKind,
  Phase,
  TaskValueKind,
  TriggerKind,
  TurnStatus,
  WaitKind,
} from "../../domain/automation/instances/enums.js";
import type {
  AwaitedEffect,
  EffectAnswer,
  EventOffer,
  Inbound,
  LifecycleEvent,
  Listening,
  PlayedTurn,
  ProgramReference,
  Receiving,
  RoutingMatch,
  RunEnding,
  RunTurn,
  RunWait,
  TaskValue,
} from "../../domain/automation/instances/interfaces.js";
import type { Run } from "../../domain/automation/instances/run.js";
import type { WorkflowInstance } from "../../domain/automation/instances/workflow-instance.js";
import type {
  JsonObject,
  JsonValue,
} from "../../domain/automation/interfaces.js";
import type { RunSecrets } from "../../domain/automation/secrets/run-secrets.js";
import type { Secret } from "../../domain/automation/secrets/secret.js";
import type { Subscription } from "../../domain/automation/subscriptions/subscription.js";
import { CheckedDefinition } from "../../domain/automation/workflows/checked-definition.js";
import { ScheduleKind } from "../../domain/automation/workflows/enums.js";
import type {
  ImportTexts,
  Schedule,
} from "../../domain/automation/workflows/interfaces.js";
import { WorkflowName } from "../../domain/automation/workflows/workflow-name.js";
import type { WorkflowVersion } from "../../domain/automation/workflows/workflow-version.js";
import type { Result } from "../../domain/interfaces.js";
import { ImportFetcher } from "../../application/automation/imports/ports.js";
import { WorkflowQueries } from "../../application/automation/workflows/queries.js";
import { IncompatibleRun } from "./incompatible-run.error.js";
import {
  type ControlStep,
  type FetchedImportText,
  InterpreterClient,
  type NeededImport,
  type Played,
  type Program,
  type ProgramCall,
  type ProgramSource,
  type ResolvedCompilation,
} from "./interfaces.js";

@Injectable()
export class InterpreterGateway
  implements
    HostCapabilities,
    DefinitionCompiler,
    WorkflowRuntime,
    EventRouting,
    SubscriptionFilters
{
  private static readonly TRIAL = "trial";
  private static readonly ROOT_EXECUTION = "";
  private static readonly WORKFLOW = "workflow";
  private static readonly RECEIVE = "receive";
  private static readonly MESSAGE = "message";
  private static readonly UNRESOLVED_IMPORT = "unresolved-import";
  private static readonly MOST_IMPORTS = 64;
  private static readonly NO_IMPORTS: ImportTexts = {};
  private static readonly NO_FAILURES: ReadonlyMap<string, string> = new Map();
  private static readonly RETRY = "@retry";
  private static readonly ATTEMPT = /#\d+$/;
  private static readonly PLATFORM_FAILURE =
    "The platform could not run the instance";
  private static readonly STATUSES: Readonly<
    Record<Step["status"], RunTurn["status"]>
  > = {
    running: TurnStatus.Running,
    suspended: TurnStatus.Suspended,
    completed: TurnStatus.Completed,
    faulted: TurnStatus.Faulted,
    cancelled: TurnStatus.Cancelled,
  };

  constructor(
    private readonly client: InterpreterClient,
    private readonly workflows: WorkflowQueries,
    private readonly fetcher: ImportFetcher,
  ) {}

  profile(): AnalysisProfile {
    const profile = this.client.profile([]);
    return {
      effects: profile.effects,
      authentications: profile.authentications,
      processes: profile.processes,
      scriptLanguages: profile.scriptLanguages,
      asyncApiProtocols: profile.asyncApiProtocols,
      mcpTransports: profile.mcpTransports,
      mcpTransportOptions: profile.mcpTransportOptions,
      schedules: profile.schedules,
      triggers: profile.triggers,
      grants: profile.grants,
    };
  }

  lifecycleEvents(): readonly LifecycleEventKind[] {
    const entries = Object.entries(lifecycleEventCatalogue);
    return entries.map(([name, entry]) => ({ name, types: entry.types }));
  }

  async compile(
    authored: DefinitionSource,
    secrets: readonly Secret[],
  ): Promise<Result<CheckedDefinition, DefinitionFailure>> {
    const source = this.#compiledSourceOf(authored);
    const names = secrets.map((secret) => secret.name);
    const resolved = await this.#resolved(
      source,
      names,
      InterpreterGateway.NO_IMPORTS,
      InterpreterGateway.NO_FAILURES,
    );
    const compilation = resolved.compilation;
    const imports = resolved.imports;

    if (compilation.kind === "expired")
      return { ok: false, failure: DefinitionRefusal.Expired };

    if (compilation.kind === "refused") {
      const problems = this.#problemsOf(
        compilation.diagnostics,
        resolved.failures,
      );
      return { ok: false, failure: problems };
    }

    const manifest = compilation.manifest;
    const identity = manifest.identity;
    const name = new WorkflowName(identity.namespace, identity.name);
    const document = compilation.document as JsonObject;
    const digest = this.#digestOf(document);
    const [declared] = manifest.schedules;
    const schedule = this.#scheduleOf(declared);
    const definition = new CheckedDefinition({
      name,
      version: identity.version,
      dsl: identity.dsl,
      digest,
      document,
      imports,
      programFingerprint: compilation.fingerprint,
      schedule,
      secrets: manifest.secrets,
    });
    return { ok: true, value: definition };
  }

  async #resolved(
    source: ProtocolObject | string,
    names: readonly string[],
    imports: ImportTexts,
    failures: ReadonlyMap<string, string>,
  ): Promise<ResolvedCompilation> {
    const compilation = await this.client.compile(source, names, imports);
    const settled = { compilation, imports, failures };

    if (compilation.kind !== "refused") return settled;

    const needed = this.#neededOf(compilation.diagnostics, imports, failures);
    const count = Object.keys(imports).length + needed.length;

    if (needed.length === 0 || count > InterpreterGateway.MOST_IMPORTS)
      return settled;

    const fetched = await Promise.all(
      needed.map((wanted) => this.#fetchedOf(wanted)),
    );
    const texts = fetched.flatMap((each) =>
      each.text === null ? [] : [[each.reference, each.text] as const],
    );
    const refused = fetched.flatMap((each) =>
      each.reason === null ? [] : [[each.reference, each.reason] as const],
    );
    const more = { ...imports, ...Object.fromEntries(texts) };
    const failed = new Map([...failures, ...refused]);
    return this.#resolved(source, names, more, failed);
  }

  #neededOf(
    diagnostics: readonly Diagnostic[],
    imports: ImportTexts,
    failures: ReadonlyMap<string, string>,
  ): readonly NeededImport[] {
    const needed = new Map<string, string>();

    for (const diagnostic of diagnostics) {
      const wanted = diagnostic.import;
      const unresolved =
        diagnostic.code === InterpreterGateway.UNRESOLVED_IMPORT;

      if (!unresolved || wanted === null || wanted.uri === null) continue;

      const reference = wanted.reference;
      const known =
        Object.hasOwn(imports, reference) || failures.has(reference);

      if (!known) needed.set(reference, wanted.uri);
    }

    return Array.from(needed, ([reference, uri]) => ({ reference, uri }));
  }

  async #fetchedOf(wanted: NeededImport): Promise<FetchedImportText> {
    const fetched = await this.fetcher.fetch(wanted.uri);
    const reference = wanted.reference;

    if (fetched.ok)
      return { reference, text: fetched.value.text, reason: null };

    return { reference, text: null, reason: fetched.failure.detail };
  }

  #compiledSourceOf(authored: DefinitionSource): ProtocolObject | string {
    if (typeof authored === "string") return authored;

    return this.#protocolObjectOf(authored);
  }

  async begin(
    instance: WorkflowInstance,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<RunTurn> {
    const call = this.#callOf(instance.versionId, null, signal);
    const context = this.#startContextOf(instance.id, secrets, now);

    if (instance.trigger !== TriggerKind.Event) {
      const input = this.#protocolValueOf(instance.input);
      const started = await this.client.start(call, input, context);
      const played = { steps: [started.step], answered: [], taken: null };
      const program = { call, fingerprint: started.fingerprint, awaited: [] };
      return this.#turnOf(program, played, []);
    }

    const correlated = await this.client.correlate(call, context);
    const events = this.#eventsIn(instance.input);
    const played = await this.#correlated(
      call,
      context,
      correlated.step,
      events,
    );
    const program = { call, fingerprint: correlated.fingerprint, awaited: [] };
    return this.#turnOf(program, played, []);
  }

  respond(
    instance: WorkflowInstance,
    answer: EffectAnswer,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<PlayedTurn> {
    return this.#played(instance, now, () =>
      this.#responded(instance, answer, secrets, now, signal),
    );
  }

  receive(
    instance: WorkflowInstance,
    receipt: Receipt,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<PlayedTurn> {
    const outcome = this.#receivedOutcomeOf(receipt.inbound);
    const answer = { effectId: receipt.wait.effectId, outcome };
    return this.respond(instance, answer, secrets, now, signal);
  }

  #receivedOutcomeOf(inbound: Inbound): JsonObject {
    switch (inbound.kind) {
      case InboundKind.Message:
        return {
          kind: InterpreterGateway.MESSAGE,
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

  offer(
    instance: WorkflowInstance,
    offer: EventOffer,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<PlayedTurn> {
    return this.#played(instance, now, () =>
      this.#offered(instance, offer, secrets, now, signal),
    );
  }

  answerChild(
    parent: WorkflowInstance,
    child: WorkflowInstance,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<PlayedTurn> {
    const effectId = child.originEffectId;

    if (effectId === null)
      throw new TypeError("The instance awaits no effect of its parent");

    const outcome = this.#childOutcomeOf(child);
    const answer = { effectId, outcome };
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
    const call = this.#callOf(version.id, null, signal);
    const trial = InterpreterGateway.TRIAL;
    const context = this.#startContextOf(trial, secrets, now);
    const correlated = await this.client.correlate(call, context);
    const offered = this.#cloudEventOf(event.cloudEvent);
    const played = await this.#correlated(call, context, correlated.step, [
      offered,
    ]);
    return played.answered.length > 0;
  }

  async accepting(
    programs: readonly ProgramReference[],
    event: AcceptedEvent,
    signal: AbortSignal,
  ): Promise<readonly RoutingMatch[]> {
    const offered = this.#cloudEventOf(event.cloudEvent);
    const matches: RoutingMatch[] = [];

    for (const program of programs) {
      const call = this.#callOf(program.versionId, null, signal);
      const routed = await this.client.route(call, offered);

      for (const route of routed)
        matches.push({
          versionId: program.versionId,
          stream: route.stream,
          level: route.level,
          filter: route.filter,
        });
    }

    return matches;
  }

  async check(
    filter: JsonObject,
  ): Promise<Result<void, readonly DefinitionProblem[]>> {
    const source = this.#protocolObjectOf(filter);
    const checked = await this.client.filter(source);

    if (checked.kind === "compiled") return { ok: true, value: undefined };

    const problems = this.#problemsOf(
      checked.diagnostics,
      InterpreterGateway.NO_FAILURES,
    );
    return { ok: false, failure: problems };
  }

  async matching(
    subscriptions: readonly Subscription[],
    event: AcceptedEvent,
    signal: AbortSignal,
  ): Promise<Subscription[]> {
    const filters = subscriptions.map((subscription) => ({
      name: subscription.id,
      filter: this.#protocolObjectOf(subscription.filter),
    }));
    const offered = this.#cloudEventOf(event.cloudEvent);
    const accepted = await this.client.accepting(filters, offered, signal);
    return subscriptions.filter((subscription) =>
      accepted.includes(subscription.id),
    );
  }

  inputProblemsOf(
    version: WorkflowVersion,
    input: JsonValue,
  ): Promise<readonly InputProblem[]> {
    const call = this.#callOf(version.id, null, null);
    const value = this.#protocolValueOf(input);
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
      detail: InterpreterGateway.PLATFORM_FAILURE,
    };
    return this.#endingOf(end);
  }

  async #cancelledEnding(
    instance: WorkflowInstance,
    now: Date,
  ): Promise<RunEnding> {
    const identity = await this.#identityOf(instance);
    const at = now.getTime();
    const end: HostEnd = {
      identity,
      instance: instance.id,
      now: at,
      phase: "cancelled",
    };
    return this.#endingOf(end);
  }

  async #identityOf(instance: WorkflowInstance): Promise<VersionIdentity> {
    const identity = await this.workflows.identityById(instance.versionId);

    if (identity === null)
      throw new TypeError(`The version ${instance.versionId} is gone`);

    return identity;
  }

  #endingOf(end: HostEnd): RunEnding {
    const ending = this.client.ending(end);
    const events = ending.events.map((event) => this.#lifecycleOf(event));
    return { events, error: ending.error };
  }

  #controlled(
    instance: WorkflowInstance,
    now: Date,
    signal: AbortSignal | null,
    control: ControlStep,
  ): Promise<PlayedTurn> {
    return this.#played(instance, now, async () => {
      const run = this.#runOf(instance);
      const program = this.#programOf(instance, run, signal);
      const state = this.#stateOf(run);
      const step = await control(program.call, state);
      const played = { steps: [step], answered: [], taken: null };
      return this.#turnOf(program, played, []);
    });
  }

  async #played(
    instance: WorkflowInstance,
    now: Date,
    turn: () => Promise<RunTurn>,
  ): Promise<PlayedTurn> {
    try {
      return await turn();
    } catch (error) {
      if (!(error instanceof IncompatibleRun)) throw error;

      const ending = await this.#cancelledEnding(instance, now);
      return { status: TurnStatus.Stranded, ending };
    }
  }

  async #responded(
    instance: WorkflowInstance,
    answer: EffectAnswer,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<RunTurn> {
    const run = this.#runOf(instance);
    const program = this.#programOf(instance, run, signal);
    const state = this.#stateOf(run);
    const context = this.#contextOf(secrets, now);
    const outcome = this.#outcomeOf(answer.outcome);
    const response: EffectResponse = { id: answer.effectId, outcome };
    const step = await this.client.respond(
      program.call,
      state,
      response,
      context,
    );
    const answered = [answer.effectId];
    const played = { steps: [step], answered, taken: null };
    const expired = outcome.kind === "expired" ? answered : [];
    return this.#turnOf(program, played, expired);
  }

  async #offered(
    instance: WorkflowInstance,
    offer: EventOffer,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<RunTurn> {
    const run = this.#runOf(instance);
    const program = this.#programOf(instance, run, signal);
    const state = this.#stateOf(run);
    const context = this.#contextOf(secrets, now);
    const event = this.#cloudEventOf(offer.event);
    const candidates = run.listeningFor(offer);
    const played = await this.#offeredTo(
      program.call,
      state,
      context,
      event,
      candidates,
    );
    return this.#turnOf(program, played, []);
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
      const step = await this.client.respond(
        call,
        current.state,
        response,
        context,
      );
      steps.push(step);

      if (!step.declined.includes(event.id)) answered.push(listen.id);
    }

    return { steps, answered, taken: null };
  }

  async #offeredTo(
    call: ProgramCall,
    state: State,
    context: StepContext,
    event: CloudEvent,
    candidates: readonly Listening[],
  ): Promise<Played> {
    const steps: Step[] = [];
    let current = state;

    for (const candidate of candidates) {
      const response: EffectResponse = {
        id: candidate.effectId,
        outcome: { kind: "event", event },
      };
      const step = await this.client.respond(call, current, response, context);
      steps.push(step);
      current = step.state;

      if (step.declined.includes(event.id)) continue;

      const taken = { eventId: event.id, execution: candidate.execution };
      return { steps, answered: [candidate.effectId], taken };
    }

    return { steps, answered: [], taken: null };
  }

  #turnOf(
    program: Program,
    played: Played,
    expired: readonly string[],
  ): RunTurn {
    const steps = played.steps;
    const last = steps[steps.length - 1];

    if (last === undefined)
      throw new TypeError("A turn is made of at least one step");

    const withdrawn = steps.flatMap((step) => step.withdrawn);
    const effects = steps.flatMap((step) => step.requested);
    const requested = effects.map((effect) => this.#awaitedOf(effect));
    const listening = effects.flatMap((effect) => this.#listeningOf(effect));
    const receiving = effects.flatMap((effect) => this.#receivingOf(effect));
    const known = program.awaited.concat(requested);
    const ended = withdrawn.concat(expired);
    const abandoned = known
      .filter((effect) => ended.includes(effect.id))
      .filter((effect) => effect.request.kind === InterpreterGateway.WORKFLOW)
      .map((effect) => effect.id);
    const events = steps.flatMap((step) => step.events);
    const endedExecutions = events.flatMap((event) =>
      this.#endedExecutionOf(event),
    );
    const lifecycle = events.map((event) => this.#lifecycleOf(event));
    const inputs = steps
      .flatMap((step) => step.taskInputs)
      .map((input) => this.#taskValueOf(input, TaskValueKind.Input));
    const outputs = steps
      .flatMap((step) => step.taskOutputs)
      .map((output) => this.#taskValueOf(output, TaskValueKind.Output));
    const taskValues = inputs.concat(outputs);
    const output = last.status === "completed" ? last.output : null;
    const error = last.status === "faulted" ? last.error : null;
    return {
      status: InterpreterGateway.STATUSES[last.status],
      fingerprint: program.fingerprint,
      format: stateFormatVersion,
      memento: last.state,
      requested,
      listening,
      receiving,
      endedExecutions,
      taskValues,
      answered: played.answered,
      withdrawn,
      abandoned,
      taken: played.taken,
      events: lifecycle,
      output,
      error,
    };
  }

  #awaitedOf(effect: Effect): AwaitedEffect {
    const request = this.#requestOf(effect);
    const wait = this.#waitOf(effect);
    return { id: effect.id, request, wait };
  }

  #contextOf(secrets: RunSecrets, now: Date): StepContext {
    const at = now.getTime();
    const values = this.#protocolObjectOf(secrets.values);
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

  #retriedOf(effectId: string): string | null {
    if (!effectId.endsWith(InterpreterGateway.RETRY)) return null;

    const next = effectId.slice(0, -InterpreterGateway.RETRY.length);
    return next.replace(InterpreterGateway.ATTEMPT, "");
  }

  #waitOf(effect: Effect): RunWait | null {
    const effectId = effect.id;
    const until = effect.deadline;

    switch (effect.kind) {
      case "timer":
        return {
          effectId,
          kind: WaitKind.Timer,
          until: effect.until,
          stream: null,
          retryOf: this.#retriedOf(effectId),
          execution: null,
          position: null,
        };
      case "listen":
        return {
          effectId,
          kind: WaitKind.Event,
          until,
          stream: effect.stream,
          retryOf: null,
          execution: null,
          position: null,
        };
      case "workflow":
        return this.#childWaitOf(effect.await, effectId, until);
      case "asyncapi":
        return this.#messageWaitOf(effect.exchange, effectId, until);
      case "http":
      case "openapi":
      case "resource":
      case "grpc":
      case "mcp":
      case "a2a":
      case "process":
      case "emit":
        return null;
    }
  }

  #childWaitOf(
    awaited: boolean,
    effectId: string,
    until: number | null,
  ): RunWait | null {
    if (!awaited) return null;

    return {
      effectId,
      kind: WaitKind.Child,
      until,
      stream: null,
      retryOf: null,
      execution: null,
      position: null,
    };
  }

  #messageWaitOf(
    exchange: AsyncApiRequest["exchange"],
    effectId: string,
    until: number | null,
  ): RunWait | null {
    if (exchange.kind !== InterpreterGateway.RECEIVE) return null;

    return {
      effectId,
      kind: WaitKind.Message,
      until,
      stream: null,
      retryOf: null,
      execution: exchange.subscription,
      position: exchange.position,
    };
  }

  #receivingOf(effect: Effect): readonly Receiving[] {
    if (effect.kind !== "asyncapi") return [];

    const exchange = effect.exchange;

    if (exchange.kind !== InterpreterGateway.RECEIVE) return [];

    const request = this.#requestOf(effect);
    return [
      {
        execution: exchange.subscription,
        request,
        closesAt: exchange.closesAt,
      },
    ];
  }

  #digestOf(document: JsonObject): string {
    const canonical = this.#canonicalOf(document);
    const text = JSON.stringify(canonical);
    return createHash("sha256").update(text).digest("hex");
  }

  #canonicalOf(value: JsonValue): JsonValue {
    if (this.#isList(value))
      return value.map((item) => this.#canonicalOf(item));

    if (typeof value !== "object" || value === null) return value;

    const sorted: Record<string, JsonValue> = {};
    const keys = Object.keys(value).toSorted();

    for (const key of keys) {
      const item = value[key];

      if (item === undefined) continue;

      sorted[key] = this.#canonicalOf(item);
    }

    return sorted;
  }

  #isList(value: JsonValue): value is readonly JsonValue[] {
    return Array.isArray(value);
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
    const call = this.#callOf(instance.versionId, fingerprint, signal);
    return { call, fingerprint, awaited: run.awaited };
  }

  #callOf(
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

    const document = this.#protocolObjectOf(program.document);
    return { document, imports: program.imports, secrets: program.secrets };
  }

  #stateOf(run: Run): State {
    return run.memento as unknown as State;
  }

  #outcomeOf(outcome: JsonObject): EffectOutcome {
    return outcome as unknown as EffectOutcome;
  }

  #requestOf(effect: Effect): JsonObject {
    return effect as unknown as JsonObject;
  }

  #triggerListenIn(
    steps: readonly Step[],
    answered: readonly string[],
  ): Effect | null {
    const withdrawn = steps.flatMap((step) => step.withdrawn);
    const requested = steps.flatMap((step) => step.requested);
    const listens = requested.filter(
      (effect) =>
        effect.kind === "listen" &&
        effect.subscription === InterpreterGateway.ROOT_EXECUTION &&
        !withdrawn.includes(effect.id) &&
        !answered.includes(effect.id),
    );
    return listens[0] ?? null;
  }

  #eventsIn(input: JsonValue): readonly CloudEvent[] {
    if (!Array.isArray(input)) return [];

    return input.map((event) => event as unknown as CloudEvent);
  }

  #listeningOf(effect: Effect): readonly Listening[] {
    if (effect.kind !== "listen") return [];

    const open = effect.open.map((filter) => ({
      level: filter.level,
      filter: filter.filter,
    }));
    const listening = {
      effectId: effect.id,
      execution: effect.subscription,
      stream: effect.stream,
      position: effect.position,
      open,
    };
    return [listening];
  }

  #taskValueOf(value: ProtocolTaskValue, kind: TaskValueKind): TaskValue {
    return { execution: value.execution, kind, value: value.value };
  }

  #endedExecutionOf(event: ProtocolEvent): readonly string[] {
    if (event.subject !== "task") return [];

    if (!this.#ends(event.name)) return [];

    return [event.execution];
  }

  #ends(name: string): boolean {
    const catalogue: Readonly<Record<string, { readonly ending: boolean }>> =
      lifecycleEventCatalogue;
    return catalogue[name]?.ending === true;
  }

  #lifecycleOf(event: ProtocolEvent): LifecycleEvent {
    const execution = event.subject === "task" ? event.execution : null;
    return {
      name: event.name,
      types: event.types,
      data: event.data,
      execution,
    };
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

  #scheduleOf(schedule: ProtocolSchedule | undefined): Schedule | null {
    if (schedule === undefined) return null;

    switch (schedule.kind) {
      case "every":
        return { kind: ScheduleKind.Every, interval: schedule.interval };
      case "cron":
        return { kind: ScheduleKind.Cron, cron: schedule.cron };
      case "after":
        return { kind: ScheduleKind.After, delay: schedule.delay };
      case "on":
        return {
          kind: ScheduleKind.On,
          stream: schedule.stream,
          types: schedule.types,
        };
    }
  }

  #problemsOf(
    diagnostics: readonly Diagnostic[],
    failures: ReadonlyMap<string, string>,
  ): readonly DefinitionProblem[] {
    return diagnostics.map((diagnostic) => {
      const start = diagnostic.range?.start ?? null;
      return {
        code: diagnostic.code,
        pointer: diagnostic.pointer,
        detail: this.#detailOf(diagnostic, failures),
        line: start?.line ?? null,
        column: start?.column ?? null,
      };
    });
  }

  #detailOf(
    diagnostic: Diagnostic,
    failures: ReadonlyMap<string, string>,
  ): string {
    const reference = diagnostic.import?.reference ?? null;
    const reason = reference === null ? undefined : failures.get(reference);

    if (reason === undefined) return diagnostic.message;

    return `Import '${String(reference)}' could not be fetched: ${reason}`;
  }

  #cloudEventOf(event: JsonObject): CloudEvent {
    return event as unknown as CloudEvent;
  }

  #protocolObjectOf(value: JsonObject): ProtocolObject {
    return value as ProtocolObject;
  }

  #protocolValueOf(value: JsonValue): ProtocolValue {
    return value as ProtocolValue;
  }
}
