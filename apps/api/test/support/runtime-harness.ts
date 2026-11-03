import { AsyncLocalStorage } from 'node:async_hooks';
import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MockAgent } from 'undici';
import {
  Phase,
  RunDirective,
} from '../../src/domain/automation/instances/enums.js';
import type {
  JsonObject,
  JsonValue,
} from '../../src/domain/automation/json.js';
import { ConfigModule } from '../../src/frameworks/di/config.module.js';
import { ResilienceModule } from '../../src/frameworks/di/resilience.module.js';
import { WorkflowsModule } from '@nestjs/workflows';
import { RuntimeModule } from '../../src/frameworks/di/runtime.module.js';
import {
  RetryableFault,
  TaskFault,
} from '../../src/frameworks/runtime/execution/faults.js';
import type {
  Durability,
  GoJudgeCommand,
  StepOptions,
} from '../../src/frameworks/runtime/interfaces.js';
import { Runtime } from '../../src/frameworks/runtime/runtime.js';
import { EndpointDispatcher } from '../../src/frameworks/undici/endpoint-dispatcher.js';
import { VerdictKind } from '../../src/interface-adapters/workflows/enums.js';
import {
  type ChildOutcome,
  type ChildRequest,
  type ChildStart,
  RunObserver,
  RuntimeChecks,
  type RunOutcome,
  type RunPlan,
  type TaskEnded,
  type TaskStarted,
} from '../../src/interface-adapters/workflows/interfaces.js';

// ---------------------------------------------------------------------------------------------
// In-memory durability: a journal of named entries, as a durable engine keeps them.

export type EntryKind =
  'step' | 'sleep' | 'wait' | 'child' | 'detached-child' | 'process' | 'event';

export interface JournalEntry {
  readonly kind: EntryKind;
  readonly value?: JsonValue;
  readonly failed?: JsonObject;
}

export type Journal = Map<string, JournalEntry>;

export interface CallRecord {
  readonly kind: EntryKind;
  readonly name: string;
  readonly replayed: boolean;
  readonly milliseconds?: number;
  readonly childId?: string;
  readonly command?: GoJudgeCommand;
  readonly key?: string;
  readonly event?: JsonObject | null;
}

export interface BackoffRecord {
  readonly name: string;
  readonly attempt: number;
  readonly milliseconds: number;
}

// Thrown instead of running the step it names: a worker crash before that step.
export class SimulatedCrash extends Error {
  constructor(readonly step: string) {
    super(`simulated crash before ${step}`);
    this.name = 'SimulatedCrash';
  }
}

export class DuplicateStepName extends Error {
  constructor(readonly step: string) {
    super(`"${step}" is used twice in one run`);
    this.name = 'DuplicateStepName';
  }
}

export class NestedDurableCall extends Error {
  constructor(kind: string, name: string, inside: string) {
    super(`${kind} "${name}" was called inside step "${inside}"`);
    this.name = 'NestedDurableCall';
  }
}

export class Nondeterminism extends Error {
  constructor(name: string, recorded: EntryKind, now: EntryKind) {
    super(`"${name}" was journaled as a ${recorded} but is now a ${now}`);
    this.name = 'Nondeterminism';
  }
}

export interface DurabilityOptions {
  // Milliseconds since the epoch the fake clock starts at.
  readonly start: number;
  // Crash (throw SimulatedCrash) before the first new step whose name this accepts.
  readonly crashBefore?: (name: string) => boolean;
  // A safety net against retry loops that never end.
  readonly maxAttempts?: number;
  // The events sent to the run, in order; once none is left a wait for one times out (null).
  readonly events?: readonly JsonObject[];
}

function cloned<T>(value: T): T {
  if (value === undefined) return null as T;

  return JSON.parse(JSON.stringify(value)) as T;
}

// Each step runs once and its result is journaled; a step named twice in one run throws; a
// sleep and a wait resolve at once and are recorded; the clock moves by the sleeps and backoffs.
export class InMemoryDurability implements Durability {
  readonly calls: CallRecord[] = [];
  readonly executed: string[] = [];
  readonly backoffs: BackoffRecord[] = [];
  readonly #visited = new Set<string>();
  readonly #inStep = new AsyncLocalStorage<string>();
  readonly #options: DurabilityOptions;
  readonly #events: JsonObject[];
  clock: number;

  constructor(
    readonly journal: Journal,
    options: DurabilityOptions,
  ) {
    this.#options = options;
    this.#events = (options.events ?? []).slice();
    this.clock = options.start;
  }

  get newSleeps(): CallRecord[] {
    return this.calls.filter((call) => call.kind === 'sleep' && !call.replayed);
  }

  get newWaits(): CallRecord[] {
    return this.calls.filter((call) => call.kind === 'wait' && !call.replayed);
  }

  attemptsOf(name: string): number {
    return this.executed.filter((executed) => executed === name).length;
  }

  // Unjournaled, as the engine's clock: a step's result keeps what its effect read.
  stepTime(): number {
    return this.clock;
  }

  async step<T>(
    name: string,
    effect: (attempt: number) => Promise<T>,
    options: StepOptions,
  ): Promise<T> {
    const entry = this.#visit(name, 'step');

    if (entry !== undefined) {
      this.calls.push({ kind: 'step', name, replayed: true });

      if (entry.failed !== undefined) throw new TaskFault(entry.failed);

      return cloned(entry.value) as T;
    }

    if (this.#options.crashBefore?.(name) === true)
      throw new SimulatedCrash(name);

    this.calls.push({ kind: 'step', name, replayed: false });
    const retry = options.retry;
    const maxAttempts = this.#options.maxAttempts ?? 50;

    for (let attempt = 1; ; attempt += 1) {
      this.executed.push(name);

      try {
        const value = await this.#inStep.run(name, () => effect(attempt));
        const stored = cloned(value) as JsonValue;
        this.journal.set(name, { kind: 'step', value: stored });
        return cloned(stored) as T;
      } catch (error) {
        if (attempt >= maxAttempts)
          throw new Error(`step "${name}" ran ${String(attempt)} attempts`);

        const again =
          retry !== null && attempt < retry.attempts && retry.retries(error);

        if (again) {
          const milliseconds = retry.backoff(attempt);
          this.backoffs.push({ name, attempt, milliseconds });
          this.clock += milliseconds;
          continue;
        }

        if (error instanceof RetryableFault) {
          this.journal.set(name, { kind: 'step', failed: error.error });
          throw new TaskFault(error.error);
        }

        throw error;
      }
    }
  }

  sleep(name: string, milliseconds: number): Promise<void> {
    const entry = this.#visit(name, 'sleep');

    if (entry !== undefined) {
      this.calls.push({ kind: 'sleep', name, replayed: true, milliseconds });
      return Promise.resolve();
    }

    this.calls.push({ kind: 'sleep', name, replayed: false, milliseconds });
    this.clock += milliseconds;
    this.journal.set(name, { kind: 'sleep' });
    return Promise.resolve();
  }

  waitForResume(name: string, milliseconds: number): Promise<void> {
    const entry = this.#visit(name, 'wait');

    if (entry !== undefined) {
      this.calls.push({ kind: 'wait', name, replayed: true, milliseconds });
      return Promise.resolve();
    }

    this.calls.push({ kind: 'wait', name, replayed: false, milliseconds });
    this.journal.set(name, { kind: 'wait' });
    return Promise.resolve();
  }

  // An awaited child resolves at once: the observer's `outcomeOf` gives its scripted end.
  awaitChild(name: string, instanceId: string): Promise<void> {
    return this.#record(name, 'child', { childId: instanceId });
  }

  detachChild(name: string, instanceId: string): Promise<void> {
    return this.#record(name, 'detached-child', { childId: instanceId });
  }

  // The next scripted event, journaled so that a replay receives the same; null once none is left
  // (the wait timed out), the clock moved by the limit given.
  waitForEvent(
    name: string,
    key: string,
    milliseconds: number | null,
  ): Promise<JsonObject | null> {
    const entry = this.#visit(name, 'event');

    if (entry !== undefined) {
      const event = (entry.value ?? null) as JsonObject | null;
      this.calls.push({ kind: 'event', name, replayed: true, key, event });
      return Promise.resolve(cloned(event));
    }

    const event = this.#events.shift() ?? null;

    if (event === null && milliseconds !== null) this.clock += milliseconds;

    this.calls.push({ kind: 'event', name, replayed: false, key, event });
    this.journal.set(name, { kind: 'event', value: event });
    return Promise.resolve(cloned(event));
  }

  detachProcess(name: string, command: GoJudgeCommand): Promise<void> {
    return this.#record(name, 'process', { command });
  }

  get children(): CallRecord[] {
    return this.calls.filter(
      (call) => call.kind === 'child' || call.kind === 'detached-child',
    );
  }

  get processes(): CallRecord[] {
    return this.calls.filter((call) => call.kind === 'process');
  }

  #record(
    name: string,
    kind: EntryKind,
    detail: { childId?: string; command?: GoJudgeCommand },
  ): Promise<void> {
    const entry = this.#visit(name, kind);
    const replayed = entry !== undefined;
    this.calls.push({ kind, name, replayed, ...detail });

    if (!replayed) this.journal.set(name, { kind });

    return Promise.resolve();
  }

  #visit(name: string, kind: EntryKind): JournalEntry | undefined {
    const inside = this.#inStep.getStore();

    if (inside !== undefined) throw new NestedDurableCall(kind, name, inside);

    if (this.#visited.has(name)) throw new DuplicateStepName(name);

    this.#visited.add(name);
    const entry = this.journal.get(name);

    if (entry !== undefined && entry.kind !== kind)
      throw new Nondeterminism(name, entry.kind, kind);

    return entry;
  }
}

// ---------------------------------------------------------------------------------------------
// A recording observer that answers a scripted directive.

export type EndedScript = (task: TaskEnded, index: number) => RunDirective;

// How the platform answers a `run: workflow`: the start of a child and, once awaited, its end.
export interface ChildScript {
  readonly start?: (request: ChildRequest, index: number) => ChildStart;
  readonly outcome?: (childId: string) => ChildOutcome;
}

export interface ChildCall {
  readonly parentId: string;
  readonly request: ChildRequest;
}

export class RecordingObserver extends RunObserver {
  readonly events: string[] = [];
  readonly started: TaskStarted[] = [];
  readonly ended: TaskEnded[] = [];
  waitingCalls = 0;
  runningCalls = 0;
  directiveCalls = 0;
  readonly childStarts: ChildCall[] = [];
  readonly outcomeReads: string[] = [];
  readonly emittedEvents: JsonObject[] = [];
  readonly listening: { key: string; types: string[] | null }[] = [];
  readonly unlistened: string[] = [];
  readonly #onEnded: EndedScript;
  readonly #answers: RunDirective[];
  readonly #children: ChildScript;

  constructor(
    onEnded: EndedScript = () => RunDirective.Continue,
    answers: RunDirective[] = [],
    children: ChildScript = {},
  ) {
    super();
    this.#onEnded = onEnded;
    this.#answers = answers.slice();
    this.#children = children;
  }

  taskStarted(_instanceId: string, task: TaskStarted): Promise<void> {
    this.started.push(task);
    this.events.push(`start ${task.reference}`);
    return Promise.resolve();
  }

  taskEnded(_instanceId: string, task: TaskEnded): Promise<RunDirective> {
    this.ended.push(task);
    this.events.push(`end ${task.reference} ${task.status}`);
    const index = this.ended.length - 1;
    return Promise.resolve(this.#onEnded(task, index));
  }

  waiting(): Promise<void> {
    this.waitingCalls += 1;
    this.events.push('waiting');
    return Promise.resolve();
  }

  running(): Promise<void> {
    this.runningCalls += 1;
    this.events.push('running');
    return Promise.resolve();
  }

  directive(): Promise<RunDirective> {
    this.directiveCalls += 1;
    const answer = this.#answers.shift() ?? RunDirective.Continue;
    this.events.push(`directive ${answer}`);
    return Promise.resolve(answer);
  }

  startChild(parentId: string, child: ChildRequest): Promise<ChildStart> {
    this.childStarts.push({ parentId, request: child });
    const index = this.childStarts.length - 1;
    this.events.push(`child ${child.namespace}/${child.name}@${child.version}`);
    const scripted = this.#children.start?.(child, index);
    const start = scripted ?? {
      childId: `child-${String(index + 1)}`,
      refusal: null,
    };
    return Promise.resolve(start);
  }

  outcomeOf(childId: string): Promise<ChildOutcome> {
    this.outcomeReads.push(childId);
    this.events.push(`outcome ${childId}`);
    const scripted = this.#children.outcome?.(childId);
    const outcome = scripted ?? {
      phase: Phase.Completed,
      output: { child: childId },
      error: null,
    };
    return Promise.resolve(outcome);
  }

  listen(
    _instanceId: string,
    key: string,
    types: string[] | null,
  ): Promise<void> {
    this.listening.push({ key, types });
    this.events.push(`listen ${key}`);
    return Promise.resolve();
  }

  unlisten(_instanceId: string, key: string): Promise<void> {
    this.unlistened.push(key);
    this.events.push(`unlisten ${key}`);
    return Promise.resolve();
  }

  emitted(_instanceId: string, event: JsonObject): Promise<void> {
    this.emittedEvents.push(event);
    this.events.push(`emitted ${JSON.stringify(event.type)}`);
    return Promise.resolve();
  }

  endedNamed(name: string): TaskEnded[] {
    return this.ended.filter((task) => task.name === name);
  }

  startedNamed(name: string): TaskStarted[] {
    return this.started.filter((task) => task.name === name);
  }
}

// ---------------------------------------------------------------------------------------------
// The runtime with its real jq, Ajv and undici clients; undici's dispatcher is a MockAgent.

export const STARTED_AT = '2026-11-03T10:00:00.000Z';

export interface RunOptions {
  readonly journal?: Journal;
  readonly observer?: RecordingObserver;
  readonly startedAt?: string;
  readonly instanceId?: string;
  readonly clockStart?: number;
  readonly crashBefore?: (name: string) => boolean;
  readonly maxAttempts?: number;
  readonly events?: readonly JsonObject[];
  // Run a document the publish checks refuse (to probe the runtime alone).
  readonly unchecked?: boolean;
}

export interface RunResult {
  readonly outcome: RunOutcome;
  readonly durability: InMemoryDurability;
  readonly observer: RecordingObserver;
  readonly journal: Journal;
  readonly plan: RunPlan;
}

export class DocumentRefused extends Error {
  constructor(readonly problem: { pointer: string; detail: string }) {
    super(
      `the publish checks refuse the document: ${problem.pointer}: ${problem.detail}`,
    );
    this.name = 'DocumentRefused';
  }
}

export class RuntimeHarness {
  constructor(
    readonly context: INestApplicationContext,
    readonly runtime: Runtime,
    readonly checks: RuntimeChecks,
    readonly agent: MockAgent,
  ) {}

  static async start(): Promise<RuntimeHarness> {
    const agent = new MockAgent();
    agent.disableNetConnect();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ResilienceModule,
        WorkflowsModule.forRoot({ worker: false, allowInMemoryStorage: true }),
        RuntimeModule,
      ],
    })
      .overrideProvider(EndpointDispatcher)
      .useValue(agent)
      .compile();
    const context = await moduleRef.init();
    const runtime = context.get(Runtime);
    const checks = context.get(RuntimeChecks);
    return new RuntimeHarness(context, runtime, checks, agent);
  }

  close(): Promise<void> {
    return this.context.close();
  }

  // Null when the publish checks accept the document, else their first problem.
  async problemOf(
    document: JsonObject,
  ): Promise<{ pointer: string; detail: string } | null> {
    const verdict = await this.checks.check(document);

    if (verdict.kind === VerdictKind.Valid) return null;

    return verdict.problem;
  }

  async run(
    document: JsonObject,
    input: JsonValue = {},
    options: RunOptions = {},
  ): Promise<RunResult> {
    if (options.unchecked !== true) {
      const problem = await this.problemOf(document);

      if (problem !== null) throw new DocumentRefused(problem);
    }

    const startedAt = options.startedAt ?? STARTED_AT;
    const plan: RunPlan = {
      instanceId: options.instanceId ?? 'instance-1',
      namespace: 'qa',
      name: 'probe',
      version: '1.0.0',
      document,
      input,
      startedAt,
    };
    const journal = options.journal ?? new Map<string, JournalEntry>();
    const durability = new InMemoryDurability(journal, {
      start: options.clockStart ?? Date.parse(startedAt),
      crashBefore: options.crashBefore,
      maxAttempts: options.maxAttempts,
      events: options.events,
    });
    const observer = options.observer ?? new RecordingObserver();
    const outcome = await this.runtime.run(plan, durability, observer);
    return { outcome, durability, observer, journal, plan };
  }
}

export function aWorkflow(
  tasks: JsonObject[],
  rest: JsonObject = {},
): JsonObject {
  const document: JsonObject = {
    document: {
      dsl: '1.0.3',
      namespace: 'qa',
      name: 'probe',
      version: '1.0.0',
    },
    do: tasks,
  };
  return Object.assign(document, rest);
}

export const ERRORS = 'https://serverlessworkflow.io/spec/1.0.0/errors/';

export const JSON_HEADERS = { 'content-type': 'application/json' };
