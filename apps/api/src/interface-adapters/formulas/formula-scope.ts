import type { DateTime } from 'luxon';
import { FormulaNamespace } from './formula-namespace.js';
import { type FormulaItem, NodeItems } from './node-items.js';

export interface FormulaExecution {
  readonly id: string;
  readonly mode: string;
  readonly startedAt: string;
}

export interface FormulaWorkflow {
  readonly id: string;
  readonly name: string;
  readonly version: number | null;
}

export interface FormulaScopeProps {
  readonly item: FormulaItem | undefined;
  readonly itemIndex: number;
  readonly input: readonly FormulaItem[];
  readonly nodes: ReadonlyMap<string, readonly FormulaItem[]>;
  readonly now: DateTime;
  readonly timezone: string;
  readonly execution: FormulaExecution;
  readonly workflow: FormulaWorkflow;
}

export class FormulaScope {
  static readonly VARIABLES = [
    '$json',
    '$input',
    '$now',
    '$today',
    '$execution',
    '$workflow',
    '$',
  ];

  static readonly NAMESPACES = ['Math', 'JSON', 'Object', 'Array', 'DateTime'];

  static readonly FUNCTIONS = [
    'String',
    'Number',
    'Boolean',
    'parseInt',
    'parseFloat',
    'encodeURIComponent',
    'decodeURIComponent',
  ];

  static readonly CONSTANTS = ['undefined', 'NaN', 'Infinity'];

  readonly #item: FormulaItem | undefined;
  readonly #itemIndex: number;
  readonly #input: readonly FormulaItem[];
  readonly #nodes: ReadonlyMap<string, readonly FormulaItem[]>;
  readonly #now: DateTime;
  readonly #timezone: string;
  readonly #execution: FormulaExecution;
  readonly #workflow: FormulaWorkflow;

  constructor(props: FormulaScopeProps) {
    this.#item = props.item;
    this.#itemIndex = props.itemIndex;
    this.#input = props.input;
    this.#nodes = props.nodes;
    this.#now = props.now;
    this.#timezone = props.timezone;
    this.#execution = props.execution;
    this.#workflow = props.workflow;
  }

  static knows(name: string): boolean {
    return (
      FormulaScope.VARIABLES.includes(name) ||
      FormulaScope.NAMESPACES.includes(name) ||
      FormulaScope.FUNCTIONS.includes(name) ||
      FormulaScope.CONSTANTS.includes(name)
    );
  }

  get timezone(): string {
    return this.#timezone;
  }

  resolve(name: string): unknown {
    if (name === '$json') return this.#item ?? {};

    if (name === '$input') {
      return new NodeItems(this.#input, this.#itemIndex);
    }

    if (name === '$now') return this.#now.setZone(this.#timezone);

    if (name === '$today') {
      return this.#now.setZone(this.#timezone).startOf('day');
    }

    if (name === '$execution') {
      return { ...this.#execution, resumeUrl: null };
    }

    if (name === '$workflow') return { ...this.#workflow };

    if (name === 'NaN') return NaN;

    if (name === 'Infinity') return Infinity;

    if (name === 'undefined') return undefined;

    return new FormulaNamespace(name);
  }

  node(name: string): NodeItems {
    const items = this.#nodes.get(name) ?? [];
    return new NodeItems(items, this.#itemIndex);
  }
}
