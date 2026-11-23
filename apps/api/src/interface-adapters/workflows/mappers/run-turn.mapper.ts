import { Injectable } from "@nestjs/common";
import { lifecycleEventCatalogue, stateFormatVersion } from "interpreter";
import type {
  AsyncApiRequest,
  Effect,
  Ending,
  LifecycleEvent as ProtocolEvent,
  State,
  Step,
  TaskValue as ProtocolTaskValue,
} from "interpreter";
import {
  EffectKind,
  TaskValueKind,
  TurnStatus,
  WaitEnd,
  WaitKind,
} from "../../../domain/automation/instances/enums.js";
import type {
  AwaitedEffect,
  LifecycleEvent,
  Listening,
  Receiving,
  RunEnding,
  RunTurn,
  RunWait,
  TaskValue,
  WaitDeadline,
} from "../../../domain/automation/instances/interfaces.js";
import type { Run } from "../../../domain/automation/instances/run.js";
import type { JsonObject } from "../../../domain/automation/interfaces.js";
import type { JsonOf, Played, Program } from "../interfaces.js";

@Injectable()
export class RunTurnMapper {
  private static readonly WORKFLOW = "workflow";
  private static readonly RECEIVE = "receive";
  private static readonly RETRY = "@retry";
  private static readonly ATTEMPT = /#\d+$/;
  private static readonly STATUSES: Readonly<
    Record<Step["status"], RunTurn["status"]>
  > = {
    running: TurnStatus.Running,
    suspended: TurnStatus.Suspended,
    completed: TurnStatus.Completed,
    faulted: TurnStatus.Faulted,
    cancelled: TurnStatus.Cancelled,
  };

  toTurn(
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
      .filter((effect) => effect.request.kind === RunTurnMapper.WORKFLOW)
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
      status: RunTurnMapper.STATUSES[last.status],
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

  toEnding(ending: Ending): RunEnding {
    const events = ending.events.map((event) => this.#lifecycleOf(event));
    return { events, error: ending.error };
  }

  toState(run: Run): State {
    return run.memento as State;
  }

  #awaitedOf(effect: Effect): AwaitedEffect {
    const kind = this.#kindOf(effect);
    const request = this.#requestOf(effect);
    const wait = this.#waitOf(effect);
    return { id: effect.id, kind, request, wait };
  }

  #kindOf(effect: Effect): EffectKind {
    switch (effect.kind) {
      case "http":
      case "openapi":
      case "resource":
      case "grpc":
      case "mcp":
      case "a2a":
        return EffectKind.Call;
      case "asyncapi":
        return this.#exchangeKindOf(effect.exchange);
      case "process":
        return effect.await ? EffectKind.Process : EffectKind.Detached;
      case "workflow":
        return EffectKind.Child;
      case "emit":
        return EffectKind.Emit;
      case "timer":
        return EffectKind.Timer;
      case "listen":
        return EffectKind.Listen;
    }
  }

  #exchangeKindOf(exchange: AsyncApiRequest["exchange"]): EffectKind {
    if (exchange.kind === RunTurnMapper.RECEIVE) return EffectKind.Receive;

    return EffectKind.Call;
  }

  #deadlinesOf(effect: Effect): readonly WaitDeadline[] {
    const deadline = effect.deadline;
    const expiry: WaitDeadline[] =
      deadline === null ? [] : [{ at: deadline, end: WaitEnd.Expired }];
    const own = this.#ownDeadlinesOf(effect);
    return expiry.concat(own);
  }

  #ownDeadlinesOf(effect: Effect): readonly WaitDeadline[] {
    if (effect.kind === "timer")
      return [{ at: effect.until, end: WaitEnd.Elapsed }];

    if (
      effect.kind !== "asyncapi" ||
      effect.exchange.kind !== RunTurnMapper.RECEIVE
    )
      return [];

    const closesAt = effect.exchange.closesAt;

    if (closesAt === null) return [];

    return [{ at: closesAt, end: WaitEnd.Closed }];
  }

  #requestOf(effect: Effect): JsonObject {
    const request: JsonOf<Effect> = effect;
    return request;
  }

  #retriedOf(effectId: string): string | null {
    const retry = effectId.endsWith(RunTurnMapper.RETRY);

    if (!retry) return null;

    const next = effectId.slice(0, -RunTurnMapper.RETRY.length);
    return next.replace(RunTurnMapper.ATTEMPT, "");
  }

  #waitOf(effect: Effect): RunWait | null {
    const effectId = effect.id;
    const until = effect.deadline;
    const deadlines = this.#deadlinesOf(effect);

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
          deadlines,
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
          deadlines,
        };
      case "workflow":
        return this.#childWaitOf(effect.await, effectId, until, deadlines);
      case "asyncapi":
        return this.#messageWaitOf(effect.exchange, effectId, until, deadlines);
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
    deadlines: readonly WaitDeadline[],
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
      deadlines,
    };
  }

  #messageWaitOf(
    exchange: AsyncApiRequest["exchange"],
    effectId: string,
    until: number | null,
    deadlines: readonly WaitDeadline[],
  ): RunWait | null {
    if (exchange.kind !== RunTurnMapper.RECEIVE) return null;

    return {
      effectId,
      kind: WaitKind.Message,
      until,
      stream: null,
      retryOf: null,
      execution: exchange.subscription,
      position: exchange.position,
      deadlines,
    };
  }

  #receivingOf(effect: Effect): readonly Receiving[] {
    if (effect.kind !== "asyncapi") return [];

    const exchange = effect.exchange;

    if (exchange.kind !== RunTurnMapper.RECEIVE) return [];

    const request = this.#requestOf(effect);
    return [
      {
        execution: exchange.subscription,
        request,
        closesAt: exchange.closesAt,
      },
    ];
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

    const ends = this.#ends(event.name);

    if (!ends) return [];

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
}
