import {
  type Duration,
  isWorkflowInterrupt,
  NonRetryableStepError,
  Workflow,
  type WorkflowContext,
  type WorkflowRunner,
  type WorkflowStepContext,
  type WorkflowStepOptions,
} from "@nestjs/workflows";
import {
  type Effect,
  type EffectOutcome,
  type EffectResponse,
  type WorkflowOutcome,
} from "interpreter";
import { PermanentFault } from "../../../domain/errors.js";
import { EngineRunGateway } from "../gateways/engine-run.gateway.js";
import {
  type ChildEffect,
  EffectClient,
  type RunAgendaView,
  type StepCall,
  type TimedWait,
} from "../interfaces.js";
import { RunController } from "../run.controller.js";
import type {
  Generation,
  OpenWorkflowRunInput,
  Performed,
  Turn,
} from "./interfaces.js";
import { ProcessRun } from "./process.run.js";
import { RunTracer } from "./run.tracer.js";

@Workflow(EngineRunGateway.RUN, { version: EngineRunGateway.VERSION })
export class OpenWorkflowRun implements WorkflowRunner<
  OpenWorkflowRunInput,
  void
> {
  private static readonly CALL_TIMEOUT: Duration = "40s";
  private static readonly PROCESS_TIMEOUT: Duration = "45s";
  private static readonly ENTRIES = 5_000;
  private static readonly BYTES = 5_000_000;

  constructor(
    private readonly runs: RunController,
    private readonly performer: EffectClient,
    private readonly engine: EngineRunGateway,
    private readonly tracer: RunTracer,
  ) {}

  run(ctx: WorkflowContext, input: OpenWorkflowRunInput): Promise<void> {
    const attributes = {
      "tenon.instance.id": input.instanceId,
      "tenon.workflow.generation": input.generation,
    };
    return this.tracer.execution(
      ctx,
      () => this.#executed(ctx, input),
      attributes,
    );
  }

  async #executed(
    ctx: WorkflowContext,
    input: OpenWorkflowRunInput,
  ): Promise<void> {
    const instanceId = input.instanceId;

    try {
      await this.#driven(ctx, input);
    } catch (error) {
      if (isWorkflowInterrupt(error)) throw error;

      await this.#step(ctx, "failed", () => this.runs.fail(instanceId));
    }
  }

  async #driven(
    ctx: WorkflowContext,
    input: OpenWorkflowRunInput,
  ): Promise<void> {
    const instanceId = input.instanceId;
    const secrets = await this.#step(ctx, "secrets", () =>
      this.runs.secretsOf(instanceId),
    );
    const failed = {
      compensate: () => this.runs.fail(instanceId),
    };
    const begun = await this.#step(
      ctx,
      "begin",
      (attempt) => this.#begun(input, attempt.signal),
      failed,
    );
    const generation = {
      ctx,
      instanceId,
      secrets,
      children: new Set<string>(),
    };
    let agenda = begun;
    let entries = 2;
    let bytes = this.#sizeOf(secrets) + this.#sizeOf(begun);

    for (let turn = 1; !agenda.ended; turn++) {
      const spent =
        entries >= OpenWorkflowRun.ENTRIES || bytes >= OpenWorkflowRun.BYTES;

      if (spent) {
        const next = input.generation + 1;
        await this.#step(ctx, "continue", () =>
          this.engine.continueIn(instanceId, next),
        );
        return;
      }

      const played = await this.#turn(generation, agenda, turn);
      entries += played.entries;
      bytes += played.bytes;
      agenda = played.agenda;
    }
  }

  #begun(
    input: OpenWorkflowRunInput,
    signal: AbortSignal,
  ): Promise<RunAgendaView> {
    const instanceId = input.instanceId;

    if (input.generation === 1) return this.runs.begin(instanceId, signal);

    return this.runs.childrenEnded(instanceId, signal);
  }

  #turn(
    generation: Generation,
    agenda: RunAgendaView,
    turn: number,
  ): Promise<Turn> {
    if (this.#busy(generation, agenda))
      return this.#performed(generation, agenda);

    return this.#waited(generation, agenda, turn);
  }

  #busy(generation: Generation, agenda: RunAgendaView): boolean {
    const calls =
      agenda.calls.length + agenda.processes.length + agenda.detached.length;
    const unstarted = this.#unstartedOf(generation, agenda);
    return calls > 0 || unstarted.length > 0;
  }

  #unstartedOf(
    generation: Generation,
    agenda: RunAgendaView,
  ): readonly ChildEffect[] {
    return agenda.children.filter(
      (effect) => !generation.children.has(effect.id),
    );
  }

  async #performed(
    generation: Generation,
    agenda: RunAgendaView,
  ): Promise<Turn> {
    const unstarted = this.#unstartedOf(generation, agenda);
    const detached = await this.#detached(generation, agenda.detached);
    const children = await Promise.all(
      unstarted.map((effect) => this.#child(generation, effect)),
    );
    const called = agenda.calls.map((effect, order) =>
      this.#call(generation, effect, order, OpenWorkflowRun.CALL_TIMEOUT),
    );
    const processed = agenda.processes.map((effect, index) =>
      this.#call(
        generation,
        effect,
        agenda.calls.length + index,
        OpenWorkflowRun.PROCESS_TIMEOUT,
      ),
    );
    const performed = await Promise.all(called.concat(processed));
    const completed = performed.toSorted((left, right) =>
      this.#byCompletion(left, right),
    );
    const answers = detached.concat(children.flat(), completed);
    const answered = await this.#answered(generation, agenda, answers);
    const entries = detached.length + children.length + performed.length;
    const bytes = this.#sizeOf(children) + this.#sizeOf(performed);
    return {
      agenda: answered.agenda,
      entries: entries + answered.entries,
      bytes: bytes + answered.bytes,
    };
  }

  async #waited(
    generation: Generation,
    agenda: RunAgendaView,
    turn: number,
  ): Promise<Turn> {
    if (agenda.receives.length === 0)
      return this.#slept(generation, agenda, turn);

    const received = await this.#received(generation, turn);
    const bytes = this.#sizeOf(received);
    const moved =
      this.#answeredAny(agenda, received) || this.#busy(generation, received);

    if (moved) return { agenda: received, entries: 1, bytes };

    const slept = await this.#slept(generation, received, turn);
    return {
      agenda: slept.agenda,
      entries: slept.entries + 1,
      bytes: slept.bytes + bytes,
    };
  }

  #received(generation: Generation, turn: number): Promise<RunAgendaView> {
    const instanceId = generation.instanceId;
    return this.#step(generation.ctx, `received#${String(turn)}`, (attempt) =>
      this.runs.received(instanceId, attempt.signal),
    );
  }

  #answeredAny(agenda: RunAgendaView, next: RunAgendaView): boolean {
    const remaining = new Set(next.receives);
    return agenda.receives.some((id) => !remaining.has(id));
  }

  async #slept(
    generation: Generation,
    agenda: RunAgendaView,
    turn: number,
  ): Promise<Turn> {
    const ctx = generation.ctx;
    const instanceId = generation.instanceId;
    const wake = ctx.signalWait(EngineRunGateway.WAKE, { key: instanceId });
    const earliest = this.#earliestOf(agenda.waits);
    const name = `wait#${String(turn)}`;

    if (earliest === null) {
      await ctx.waitForAny(name, { wake });
      return this.#reread(generation, turn);
    }

    const time = ctx.timer({ until: earliest });
    const woken = await ctx.waitForAny(name, { wake, time });

    if (woken.key === "wake") return this.#reread(generation, turn);

    const now = ctx.now();
    const answers = agenda.waits.flatMap((wait) =>
      this.#timeAnswerOf(wait, now),
    );
    const answered = await this.#answered(generation, agenda, answers);
    return {
      agenda: answered.agenda,
      entries: answered.entries + 1,
      bytes: answered.bytes,
    };
  }

  async #reread(generation: Generation, turn: number): Promise<Turn> {
    const instanceId = generation.instanceId;
    const agenda = await this.#step(
      generation.ctx,
      `agenda#${String(turn)}`,
      (attempt) => this.runs.childrenEnded(instanceId, attempt.signal),
    );
    const bytes = this.#sizeOf(agenda);
    return { agenda, entries: 2, bytes };
  }

  async #answered(
    generation: Generation,
    agenda: RunAgendaView,
    answers: readonly EffectResponse[],
  ): Promise<Turn> {
    const instanceId = generation.instanceId;
    let current = agenda;
    let bytes = 0;

    for (const answer of answers) {
      current = await this.#step(
        generation.ctx,
        `respond:${answer.id}`,
        (attempt) =>
          this.runs.respond(
            instanceId,
            answer.id,
            answer.outcome,
            attempt.signal,
          ),
      );
      bytes += this.#sizeOf(current);
    }

    return { agenda: current, entries: answers.length, bytes };
  }

  async #detached(
    generation: Generation,
    effects: readonly Effect[],
  ): Promise<EffectResponse[]> {
    const ctx = generation.ctx;
    const answers: EffectResponse[] = [];

    for (const effect of effects) {
      const request = this.performer.sandboxed(effect);
      const input = { request, secrets: generation.secrets };
      const id = `${ctx.workflowId}/${effect.id}`;
      await ctx.startChild(ProcessRun, input, { id, parentClose: "abandon" });
      answers.push({ id: effect.id, outcome: { kind: "started" } });
    }

    return answers;
  }

  async #child(
    generation: Generation,
    effect: ChildEffect,
  ): Promise<EffectResponse[]> {
    const instanceId = generation.instanceId;
    const start = await this.#step(generation.ctx, `child:${effect.id}`, () =>
      this.runs.startChild(instanceId, effect),
    );
    generation.children.add(effect.id);

    if (start.kind === "started") return [];

    return [{ id: effect.id, outcome: { kind: "missing" } }];
  }

  #call(
    generation: Generation,
    effect: Effect,
    order: number,
    timeout: Duration,
  ): Promise<Performed> {
    return this.#step(
      generation.ctx,
      effect.id,
      (attempt) => this.#performedBy(generation, effect, order, attempt),
      { timeout },
    );
  }

  async #performedBy(
    generation: Generation,
    effect: Effect,
    order: number,
    attempt: WorkflowStepContext,
  ): Promise<Performed> {
    const step = {
      idempotencyKey: attempt.idempotencyKey,
      signal: attempt.signal,
      secrets: generation.secrets,
    };
    const outcome = await this.#outcomeOf(generation.instanceId, effect, step);
    const at = Date.now();
    return { id: effect.id, outcome, attempt: attempt.attempt, at, order };
  }

  async #outcomeOf(
    instanceId: string,
    effect: Effect,
    step: StepCall,
  ): Promise<EffectOutcome> {
    if (effect.kind === "emit") return this.runs.emit(instanceId, effect.event);

    if (effect.kind === "workflow") return this.#started(instanceId, effect);

    return this.performer.perform(effect, step);
  }

  async #started(
    instanceId: string,
    effect: ChildEffect,
  ): Promise<WorkflowOutcome> {
    const start = await this.runs.startChild(instanceId, effect);

    if (start.kind === "missing") return { kind: "missing" };

    return { kind: "started" };
  }

  async #step<T>(
    ctx: WorkflowContext,
    name: string,
    work: (attempt: WorkflowStepContext) => Promise<T>,
    options: WorkflowStepOptions<T> = {},
  ): Promise<T> {
    const result: unknown = await ctx.step<T>(
      name,
      (attempt) =>
        this.tracer.attempt(name, attempt, () =>
          this.#attempted(work, attempt),
        ),
      options,
    );
    return result as T;
  }

  async #attempted<T>(
    work: (attempt: WorkflowStepContext) => Promise<T>,
    attempt: WorkflowStepContext,
  ): Promise<T> {
    try {
      return await work(attempt);
    } catch (error) {
      if (error instanceof PermanentFault)
        throw new NonRetryableStepError(error.message, { cause: error });

      throw error;
    }
  }

  #sizeOf(value: unknown): number {
    const text = JSON.stringify(value);
    return Buffer.byteLength(text);
  }

  #byCompletion(left: Performed, right: Performed): number {
    if (left.attempt !== right.attempt) return left.attempt - right.attempt;

    if (left.at !== right.at) return left.at - right.at;

    return left.order - right.order;
  }

  #earliestOf(waits: readonly TimedWait[]): number | null {
    const instants = waits.flatMap((wait) =>
      wait.answers.map((answer) => answer.at),
    );

    if (instants.length === 0) return null;

    return Math.min(...instants);
  }

  #timeAnswerOf(wait: TimedWait, now: number): EffectResponse[] {
    const due = wait.answers.find((answer) => answer.at <= now);

    if (due === undefined) return [];

    return [{ id: wait.id, outcome: due.outcome }];
  }
}
