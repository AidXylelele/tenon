import type { DateTime } from 'luxon';
import {
  type FormulaExecution,
  FormulaScope,
  type FormulaWorkflow,
} from '../../formulas/formula-scope.js';
import type { FormulaItem } from '../../formulas/node-items.js';
import { FieldPath } from './field-path.js';

export interface UpstreamItems {
  readonly nodeId: string;
  readonly name: string;
  readonly items: readonly FormulaItem[];
}

export interface ResolutionContextProps {
  readonly item: FormulaItem | undefined;
  readonly itemIndex: number;
  readonly input: readonly FormulaItem[];
  readonly upstream: readonly UpstreamItems[];
  readonly now: DateTime;
  readonly timezone: string;
  readonly execution: FormulaExecution;
  readonly workflow: FormulaWorkflow;
}

export class ResolutionContext {
  static readonly CURRENT_ITEM = '$item';

  readonly #item: FormulaItem | undefined;
  readonly #itemIndex: number;
  readonly #upstream: readonly UpstreamItems[];
  readonly #formulaScope: FormulaScope;

  constructor(props: ResolutionContextProps) {
    this.#item = props.item;
    this.#itemIndex = props.itemIndex;
    this.#upstream = props.upstream;
    const nodes = new Map<string, readonly FormulaItem[]>();

    for (const node of props.upstream) {
      nodes.set(node.name, node.items);
    }

    this.#formulaScope = new FormulaScope({
      item: props.item,
      itemIndex: props.itemIndex,
      input: props.input,
      nodes,
      now: props.now,
      timezone: props.timezone,
      execution: props.execution,
      workflow: props.workflow,
    });
  }

  get formulaScope(): FormulaScope {
    return this.#formulaScope;
  }

  field(nodeId: string, path: string): unknown {
    const source =
      nodeId === ResolutionContext.CURRENT_ITEM
        ? this.#item
        : this.upstreamItem(nodeId);
    return new FieldPath(path).read(source);
  }

  private upstreamItem(nodeId: string): FormulaItem | undefined {
    const node = this.#upstream.find((upstream) => upstream.nodeId === nodeId);
    return node?.items[this.#itemIndex];
  }
}
