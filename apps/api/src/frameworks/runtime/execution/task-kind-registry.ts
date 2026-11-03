import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject } from '../../../domain/automation/json.js';
import { TaskKind } from '../enums.js';
import { TaskKinds } from '../document/task-kind.js';
import type { CompositeKind, LeafKind } from './endings.js';

// Which code runs a task: its kind, a call by what it calls, a run by what it runs.
export class TaskKindRegistry {
  static readonly #CALLS = new Set([
    'http',
    'openapi',
    'grpc',
    'asyncapi',
    'a2a',
    'mcp',
  ]);
  static readonly #PROCESSES = ['workflow', 'script', 'shell', 'container'];

  constructor(
    private readonly leaves: ReadonlyMap<string, LeafKind>,
    private readonly composites: ReadonlyMap<string, CompositeKind>,
  ) {}

  leafOf(task: Specification.Task): LeafKind | null {
    const key = TaskKindRegistry.keyOf(task);
    return this.leaves.get(key) ?? null;
  }

  compositeOf(task: Specification.Task): CompositeKind {
    const key = TaskKindRegistry.keyOf(task);
    const composite = this.composites.get(key);

    if (composite === undefined)
      throw new TypeError(`No runtime runs the task kind ${key}`);

    return composite;
  }

  static keyOf(task: Specification.Task): string {
    const kind = TaskKinds.of(task);

    if (kind === TaskKind.Call) {
      const call = String((task as Specification.CallTask).call);
      const builtIn = TaskKindRegistry.#CALLS.has(call);
      return builtIn ? `call:${call}` : 'call:function';
    }

    if (kind === TaskKind.Run) {
      const run = (task as Specification.RunTask).run as JsonObject;
      const process = TaskKindRegistry.#PROCESSES.find((name) =>
        Object.hasOwn(run, name),
      );
      return `run:${process ?? 'unknown'}`;
    }

    return kind ?? 'unknown';
  }
}
