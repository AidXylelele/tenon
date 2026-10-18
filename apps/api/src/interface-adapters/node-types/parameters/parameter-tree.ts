import type { NodeParameters } from '../../../domain/interfaces.js';
import { FieldReference } from './field-reference.js';
import { FixedValue } from './fixed-value.js';
import { FormulaValue } from './formula-value.js';
import { MalformedValue } from './malformed-value.js';
import { ParameterGroup } from './parameter-group.js';
import { ParameterList } from './parameter-list.js';
import type { ParameterValue } from './parameter-value.js';
import type { ResolutionContext } from './resolution-context.js';

const BINDING_KEYS = ['fixed', 'ref', 'formula'];

export class ParameterTree {
  readonly #root: ParameterGroup;

  private constructor(root: ParameterGroup) {
    this.#root = root;
  }

  static parse(raw: NodeParameters): ParameterTree {
    const root = ParameterTree.group('', raw);
    return new ParameterTree(root);
  }

  get leaves(): ParameterValue[] {
    return this.#root.leaves();
  }

  get malformed(): MalformedValue[] {
    return this.leaves.filter((leaf) => leaf instanceof MalformedValue);
  }

  get formulas(): FormulaValue[] {
    return this.leaves.filter((leaf) => leaf instanceof FormulaValue);
  }

  get references(): FieldReference[] {
    return this.leaves.filter((leaf) => leaf instanceof FieldReference);
  }

  get dynamicPaths(): string[] {
    return this.leaves
      .filter((leaf) => leaf.isDynamic)
      .map((leaf) => leaf.path);
  }

  resolve(context: ResolutionContext): Record<string, unknown> {
    return this.#root.resolve(context);
  }

  sketch(): Record<string, unknown> {
    return this.#root.sketch();
  }

  renameNodes(names: ReadonlyMap<string, string>): NodeParameters {
    return this.#root.renameNodes(names);
  }

  private static value(path: string, raw: unknown): ParameterValue {
    const isArray = Array.isArray(raw);

    if (isArray) return ParameterTree.list(path, raw);

    if (raw === null || typeof raw !== 'object') {
      return new MalformedValue(path, raw);
    }

    const keys = Object.keys(raw);
    const bindingKeys = keys.filter((key) => BINDING_KEYS.includes(key));

    if (bindingKeys.length === 0) {
      return ParameterTree.group(path, raw as Record<string, unknown>);
    }

    if (keys.length !== 1) return new MalformedValue(path, raw);

    return ParameterTree.binding(path, raw as Record<string, unknown>);
  }

  private static binding(
    path: string,
    raw: Record<string, unknown>,
  ): ParameterValue {
    if ('fixed' in raw) return new FixedValue(path, raw.fixed);

    if ('formula' in raw) {
      return typeof raw.formula === 'string'
        ? new FormulaValue(path, raw.formula)
        : new MalformedValue(path, raw);
    }

    const reference = raw.ref as { node?: unknown; path?: unknown } | null;

    if (
      !reference ||
      typeof reference.node !== 'string' ||
      typeof reference.path !== 'string'
    ) {
      return new MalformedValue(path, raw);
    }

    return new FieldReference(path, reference.node, reference.path);
  }

  private static group(
    path: string,
    raw: Readonly<Record<string, unknown>>,
  ): ParameterGroup {
    const members = new Map<string, ParameterValue>();

    for (const [key, value] of Object.entries(raw)) {
      const memberPath = ParameterTree.join(path, key);
      const member = ParameterTree.value(memberPath, value);
      members.set(key, member);
    }

    return new ParameterGroup(path, members);
  }

  private static list(path: string, raw: readonly unknown[]): ParameterList {
    const elements: ParameterValue[] = [];

    for (let index = 0; index < raw.length; index++) {
      const position = String(index);
      const elementPath = ParameterTree.join(path, position);
      const element = ParameterTree.value(elementPath, raw[index]);
      elements.push(element);
    }

    return new ParameterList(path, elements);
  }

  private static join(path: string, key: string): string {
    return path === '' ? key : `${path}.${key}`;
  }
}
