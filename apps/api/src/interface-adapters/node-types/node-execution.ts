import type { DateTime } from 'luxon';
import type { z } from 'zod';
import type { Item } from '../../application/interfaces.js';
import type { NodeParameters } from '../../domain/interfaces.js';
import type {
  FormulaExecution,
  FormulaWorkflow,
} from '../formulas/formula-scope.js';
import { NodeLimitError } from './node-limit-error.js';
import type { NodeRun, StepLimits } from './node-type.js';
import { NodeUserError } from './node-user-error.js';
import { ParameterError } from './parameters/parameter-error.js';
import { ParameterTree } from './parameters/parameter-tree.js';
import {
  ResolutionContext,
  type UpstreamItems,
} from './parameters/resolution-context.js';

export interface NodeExecutionProps<P> {
  readonly schema: z.ZodType<P>;
  readonly limits: StepLimits;
  readonly parameters: NodeParameters;
  readonly inputs: ReadonlyMap<string, readonly Item[]>;
  readonly upstream: readonly UpstreamItems[];
  readonly firstItemOnly: boolean;
  readonly now: DateTime;
  readonly timezone: string;
  readonly execution: FormulaExecution;
  readonly workflow: FormulaWorkflow;
}

export class NodeExecution<P> implements NodeRun<P> {
  readonly #schema: z.ZodType<P>;
  readonly #limits: StepLimits;
  readonly #tree: ParameterTree;
  readonly #inputs: ReadonlyMap<string, readonly Item[]>;
  readonly #upstream: readonly UpstreamItems[];
  readonly #now: DateTime;
  readonly #timezone: string;
  readonly #execution: FormulaExecution;
  readonly #workflow: FormulaWorkflow;
  #resolvedBytes = 0;

  constructor(props: NodeExecutionProps<P>) {
    this.#schema = props.schema;
    this.#limits = props.limits;
    this.#tree = ParameterTree.parse(props.parameters);
    this.#inputs = props.firstItemOnly
      ? NodeExecution.firstItems(props.inputs)
      : props.inputs;
    this.#upstream = props.upstream;
    this.#now = props.now;
    this.#timezone = props.timezone;
    this.#execution = props.execution;
    this.#workflow = props.workflow;
  }

  get items(): readonly Item[] {
    const [first] = this.#inputs.values();
    return first ?? [];
  }

  get limits(): StepLimits {
    return this.#limits;
  }

  get timezone(): string {
    return this.#timezone;
  }

  get now(): DateTime {
    return this.#now;
  }

  input(port: string): readonly Item[] {
    return this.#inputs.get(port) ?? [];
  }

  parameters(): P {
    return this.parametersOf(0);
  }

  parametersOf(index: number): P {
    const resolved = this.resolve(index);
    this.count(resolved);
    const result = this.#schema.safeParse(resolved);

    if (!result.success) {
      const [issue] = result.error.issues;
      const parameter = issue?.path.map(String).join('.') || null;
      const label = parameter ?? 'Parameters';
      const reason = issue?.message ?? 'invalid value';
      throw new NodeUserError(`${label}: ${reason}`, parameter, index);
    }

    return result.data;
  }

  private count(resolved: Record<string, unknown>): void {
    const text = JSON.stringify(resolved);
    this.#resolvedBytes += Buffer.byteLength(text);

    if (this.#resolvedBytes <= this.#limits.bytes) return;

    throw new NodeLimitError(
      `The resolved parameters exceed ${this.#limits.bytes} bytes`,
    );
  }

  private resolve(index: number): Record<string, unknown> {
    const context = new ResolutionContext({
      item: this.items[index],
      itemIndex: index,
      input: this.items,
      upstream: this.#upstream,
      now: this.#now,
      timezone: this.#timezone,
      execution: this.#execution,
      workflow: this.#workflow,
    });

    try {
      return this.#tree.resolve(context);
    } catch (error) {
      if (!(error instanceof ParameterError)) throw error;

      if (error.limit) {
        throw new NodeLimitError(`${error.parameter}: ${error.message}`);
      }

      throw new NodeUserError(
        `${error.parameter}: ${error.message}`,
        error.parameter,
        index,
      );
    }
  }

  private static firstItems(
    inputs: ReadonlyMap<string, readonly Item[]>,
  ): ReadonlyMap<string, readonly Item[]> {
    const trimmed = new Map<string, readonly Item[]>();

    for (const [port, items] of inputs) {
      const firstOnly = items.slice(0, 1);
      trimmed.set(port, firstOnly);
    }

    return trimmed;
  }
}
