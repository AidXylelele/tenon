import type { Specification } from '@openworkflowspec/sdk';
import type {
  JsonObject,
  JsonValue,
} from '../../../../domain/automation/json.js';
import { type CompositeKind, EndingKind, type ListEnding } from '../endings.js';
import type { Evaluator } from '../evaluator.js';
import type { EventFilters } from '../events/event-filters.js';
import { ErrorKind, TaskFault } from '../faults.js';
import { EventTypes } from '../../document/event-types.js';
import { Journal, type Journaled } from '../journal.js';
import type { Scope } from '../scope.js';

interface Strategy {
  readonly kind: 'one' | 'any' | 'all';
  readonly filters: readonly JsonObject[];
  readonly until: string | null;
}

interface Match {
  readonly consumed: boolean;
  readonly done: boolean;
  readonly filter: number;
  readonly correlation: JsonObject;
  // When the event was matched, on the engine's clock: the next wait counts from it.
  readonly at: number;
}

// `listen`: the instance waits, holding no worker, for the events its strategy names (`one`,
// `any` until a condition, `all`), accepted after it began to listen; its output is the
// consumed events in its read mode (`data` by default, `envelope`, `raw`).
export class ListenKind implements CompositeKind {
  constructor(
    private readonly filters: EventFilters,
    private readonly evaluator: Evaluator,
  ) {}

  async run(
    task: Specification.Task,
    input: JsonValue,
    _args: JsonObject,
    scope: Scope,
  ): Promise<ListEnding> {
    const run = scope.run;
    const listen = (task as Specification.ListenTask).listen;
    const strategy = ListenKind.#strategyOf((listen?.to ?? {}) as JsonObject);
    const read = listen?.read ?? 'data';
    const key = `${run.plan.instanceId}${scope.stepName}`;
    const types = ListenKind.#typesOf(strategy);
    const began = await Journal.value(scope, 'listen', async () => {
      await run.observer.listen(run.plan.instanceId, key, types);
      await run.observer.waiting(run.plan.instanceId);
      return run.durability.stepTime();
    });

    if (!began.ok)
      return {
        kind: EndingKind.Faulted,
        error: began.error,
        retryAt: began.retryAt,
      };

    const consumed: JsonObject[] = [];
    const matched = new Set<number>();
    let correlation: JsonObject = {};
    let lastAt = began.value;

    for (let received = 1; ; received += 1) {
      const name = scope.named(`event${String(received)}`);
      const remaining = ListenKind.#remaining(scope, lastAt);
      const event = await run.durability.waitForEvent(name, key, remaining);

      if (event === null) {
        const timedOut = TaskFault.of(
          ErrorKind.Timeout,
          scope.pointer,
          'The listen outlasted its timeout',
        );
        const stopped = await this.#stop(scope, key, timedOut);
        const retryAt = stopped.ok ? null : stopped.retryAt;
        return { kind: EndingKind.Faulted, error: timedOut.error, retryAt };
      }

      const marker = `match${String(received)}`;
      const known = correlation;
      const decided = await Journal.value(scope, marker, () =>
        this.#match(strategy, event, matched, consumed, known, scope),
      );

      if (!decided.ok) {
        await this.#stop(scope, key, null);
        return {
          kind: EndingKind.Faulted,
          error: decided.error,
          retryAt: decided.retryAt,
        };
      }

      const match = decided.value as unknown as Match;
      correlation = match.correlation;
      lastAt = match.at;

      if (match.consumed) {
        consumed.push(event);
        matched.add(match.filter);
      }

      if (match.done) break;
    }

    await this.#stop(scope, key, null);
    const output = ListenKind.#read(consumed, read);
    return { kind: EndingKind.Completed, output, ended: false };
  }

  async #match(
    strategy: Strategy,
    event: JsonObject,
    matched: ReadonlySet<number>,
    consumed: readonly JsonObject[],
    known: JsonObject,
    scope: Scope,
  ): Promise<JsonObject> {
    const correlation: Record<string, JsonValue> = {};
    Object.assign(correlation, known);
    const filter = await this.#firstMatching(
      strategy,
      event,
      matched,
      correlation,
      scope,
    );
    const consumed_ =
      filter >= 0 || (strategy.kind === 'any' && strategy.filters.length === 0);
    const at = scope.run.durability.stepTime();

    if (!consumed_)
      return { consumed: false, done: false, filter, correlation: known, at };

    const done = await this.#done(
      strategy,
      matched,
      filter,
      consumed,
      event,
      scope,
    );
    return { consumed: true, done, filter, correlation, at };
  }

  async #firstMatching(
    strategy: Strategy,
    event: JsonObject,
    matched: ReadonlySet<number>,
    correlation: Record<string, JsonValue>,
    scope: Scope,
  ): Promise<number> {
    for (const [index, filter] of strategy.filters.entries()) {
      if (strategy.kind === 'all' && matched.has(index)) continue;

      const holds = await this.filters.matches(
        filter,
        event,
        correlation,
        scope.pointer,
      );

      if (holds) return index;
    }

    return -1;
  }

  async #done(
    strategy: Strategy,
    matched: ReadonlySet<number>,
    filter: number,
    consumed: readonly JsonObject[],
    event: JsonObject,
    scope: Scope,
  ): Promise<boolean> {
    if (strategy.kind === 'all')
      return matched.size + 1 >= strategy.filters.length;

    if (strategy.kind === 'one' || strategy.until === null) return true;

    const events = consumed.concat([event]);
    return this.evaluator.condition(strategy.until, events, {}, scope.pointer);
  }

  // The listen ends: its listener goes and the instance runs again. A timeout faults it in this
  // step, where the retry of that fault is decided.
  #stop(
    scope: Scope,
    key: string,
    fault: TaskFault | null,
  ): Promise<Journaled<null>> {
    const run = scope.run;
    return Journal.value(scope, 'listened', async () => {
      await run.observer.unlisten(run.plan.instanceId, key);
      await run.observer.running(run.plan.instanceId);

      if (fault !== null) throw fault;

      return null;
    });
  }

  static #strategyOf(to: JsonObject): Strategy {
    if (to.one !== undefined)
      return { kind: 'one', filters: [to.one as JsonObject], until: null };

    if (to.all !== undefined)
      return { kind: 'all', filters: to.all as JsonObject[], until: null };

    const until = typeof to.until === 'string' ? to.until : null;
    return { kind: 'any', filters: (to.any ?? []) as JsonObject[], until };
  }

  // The event types a listener narrows to, or none when a filter takes any type.
  static #typesOf(strategy: Strategy): string[] | null {
    return EventTypes.of(strategy.filters);
  }

  // The milliseconds left before the task's deadline, counted from the step that read `now`.
  static #remaining(scope: Scope, now: number): number | null {
    const deadline = scope.deadline;

    if (deadline === null) return null;

    return Math.max(deadline - now, 0);
  }

  static #read(consumed: readonly JsonObject[], read: string): JsonValue {
    if (read === 'envelope') return consumed.slice();

    // `raw` keeps the data as it came: a binary payload stays base64 (CloudEvents JSON format).
    if (read === 'raw')
      return consumed.map((event) => event.data_base64 ?? event.data ?? null);

    return consumed.map((event) => event.data ?? null);
  }
}
