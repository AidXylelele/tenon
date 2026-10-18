import { DateTime, Duration } from 'luxon';
import type { FormulaBudget } from './formula-budget.js';
import { FormulaError } from './formula-error.js';
import { FormulaNamespace } from './formula-namespace.js';
import type { FormulaScope } from './formula-scope.js';
import { NodeItems } from './node-items.js';

const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

const STRING_METHODS = new Set([
  'at',
  'charAt',
  'concat',
  'endsWith',
  'includes',
  'indexOf',
  'lastIndexOf',
  'localeCompare',
  'normalize',
  'padEnd',
  'padStart',
  'repeat',
  'replace',
  'replaceAll',
  'slice',
  'split',
  'startsWith',
  'substring',
  'toLowerCase',
  'toString',
  'toUpperCase',
  'trim',
  'trimEnd',
  'trimStart',
]);

const NUMBER_METHODS = new Set(['toFixed', 'toPrecision', 'toString']);

const ARRAY_METHODS = new Set([
  'at',
  'concat',
  'flat',
  'includes',
  'indexOf',
  'join',
  'lastIndexOf',
  'slice',
  'toReversed',
  'toSorted',
]);

const DATE_GETTERS = new Set([
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
  'millisecond',
  'weekday',
  'weekNumber',
  'ordinal',
  'daysInMonth',
  'zoneName',
]);

const DATE_METHODS = new Set([
  'diff',
  'endOf',
  'equals',
  'hasSame',
  'minus',
  'plus',
  'set',
  'setZone',
  'startOf',
  'toFormat',
  'toISO',
  'toISODate',
  'toMillis',
  'toSeconds',
  'toUTC',
  'toUnixInteger',
]);

const DURATION_METHODS = new Set(['as', 'toISO', 'toMillis', 'toObject']);

const ITEMS_METHODS = new Set(['all', 'first', 'last']);

const NAMESPACE_METHODS: Readonly<Record<string, ReadonlySet<string>>> = {
  Math: new Set([
    'abs',
    'ceil',
    'exp',
    'floor',
    'log',
    'max',
    'min',
    'pow',
    'random',
    'round',
    'sign',
    'sqrt',
    'trunc',
  ]),
  JSON: new Set(['parse', 'stringify']),
  Object: new Set(['entries', 'fromEntries', 'keys', 'values']),
  Array: new Set(['isArray']),
  DateTime: new Set([
    'fromISO',
    'fromFormat',
    'fromMillis',
    'fromSeconds',
    'now',
  ]),
};

const NAMESPACE_CONSTANTS: Readonly<
  Record<string, Readonly<Record<string, number>>>
> = {
  Math: { PI: Math.PI, E: Math.E },
};

const FUNCTIONS: Readonly<Record<string, (...args: never[]) => unknown>> = {
  String,
  Number,
  Boolean,
  parseInt,
  parseFloat,
  encodeURIComponent,
  decodeURIComponent,
};

export class FormulaMethods {
  readonly #budget: FormulaBudget;
  readonly #scope: FormulaScope;

  constructor(budget: FormulaBudget, scope: FormulaScope) {
    this.#budget = budget;
    this.#scope = scope;
  }

  property(receiver: unknown, name: string): unknown {
    const forbidden = FORBIDDEN.has(name);

    if (forbidden) {
      throw new FormulaError(
        'evaluation',
        `"${name}" cannot be read in a formula`,
      );
    }

    if (receiver === null || receiver === undefined) {
      const missing = String(receiver);
      throw new FormulaError(
        'evaluation',
        `Cannot read "${name}" of ${missing}`,
      );
    }

    if (receiver instanceof NodeItems)
      return this.itemsProperty(receiver, name);

    if (receiver instanceof FormulaNamespace) {
      return this.namespaceProperty(receiver, name);
    }

    if (receiver instanceof DateTime) return this.dateProperty(receiver, name);

    if (receiver instanceof Duration) {
      return this.methodOnly(DURATION_METHODS, name);
    }

    if (typeof receiver === 'string')
      return this.stringProperty(receiver, name);

    const isArray = Array.isArray(receiver);

    if (isArray) return this.arrayProperty(receiver, name);

    if (typeof receiver === 'object') return this.ownProperty(receiver, name);

    if (typeof receiver === 'number')
      return this.methodOnly(NUMBER_METHODS, name);

    return undefined;
  }

  call(receiver: unknown, name: string, args: unknown[]): unknown {
    if (receiver === null || receiver === undefined) {
      const missing = String(receiver);
      throw new FormulaError(
        'evaluation',
        `Cannot call "${name}" of ${missing}`,
      );
    }

    const itemsMethod = ITEMS_METHODS.has(name);

    if (receiver instanceof NodeItems && itemsMethod) {
      return this.callItems(receiver, name);
    }

    if (receiver instanceof FormulaNamespace) {
      return this.callNamespace(receiver, name, args);
    }

    const dateMethod = DATE_METHODS.has(name);

    if (receiver instanceof DateTime && dateMethod) {
      return this.invoke(receiver, name, args);
    }

    const durationMethod = DURATION_METHODS.has(name);

    if (receiver instanceof Duration && durationMethod) {
      return this.invoke(receiver, name, args);
    }

    const stringMethod = STRING_METHODS.has(name);

    if (typeof receiver === 'string' && stringMethod) {
      this.checkGrowth(receiver, name, args);
      return this.invoke(receiver, name, args);
    }

    const numberMethod = NUMBER_METHODS.has(name);

    if (typeof receiver === 'number' && numberMethod) {
      return this.invoke(receiver, name, args);
    }

    const isArray = Array.isArray(receiver);
    const arrayMethod = ARRAY_METHODS.has(name);

    if (isArray && arrayMethod) {
      return this.invoke(receiver, name, args);
    }

    throw new FormulaError(
      'evaluation',
      `"${name}" cannot be called in a formula`,
    );
  }

  callFunction(name: string, args: unknown[]): unknown {
    if (name === '$') {
      const nodeName = String(args[0]);
      return this.#scope.node(nodeName);
    }

    const callable = FUNCTIONS[name];

    if (!callable) {
      throw new FormulaError('evaluation', `"${name}" cannot be called`);
    }

    return (callable as (...values: unknown[]) => unknown)(...args);
  }

  private itemsProperty(items: NodeItems, name: string): unknown {
    if (name === 'item') return items.item;

    return this.methodOnly(ITEMS_METHODS, name);
  }

  private namespaceProperty(
    namespace: FormulaNamespace,
    name: string,
  ): unknown {
    const constant = NAMESPACE_CONSTANTS[namespace.name]?.[name];

    if (constant !== undefined) return constant;

    const methods = NAMESPACE_METHODS[namespace.name] ?? new Set<string>();
    return this.methodOnly(methods, name);
  }

  private dateProperty(date: object, name: string): unknown {
    const getter = DATE_GETTERS.has(name);

    if (getter) {
      return (date as unknown as Record<string, unknown>)[name];
    }

    return this.methodOnly(DATE_METHODS, name);
  }

  private stringProperty(value: string, name: string): unknown {
    if (name === 'length') return value.length;

    const numeric = /^\d+$/.test(name);

    if (numeric) {
      const index = Number(name);
      return value.charAt(index);
    }

    return this.methodOnly(STRING_METHODS, name);
  }

  private arrayProperty(values: readonly unknown[], name: string): unknown {
    if (name === 'length') return values.length;

    const numeric = /^\d+$/.test(name);

    if (numeric) return values[Number(name)];

    return this.methodOnly(ARRAY_METHODS, name);
  }

  private ownProperty(value: object, name: string): unknown {
    const own = Object.hasOwn(value, name);

    if (!own) return undefined;

    return (value as Record<string, unknown>)[name];
  }

  private methodOnly(methods: ReadonlySet<string>, name: string): undefined {
    const isMethod = methods.has(name);

    if (isMethod) {
      throw new FormulaError(
        'evaluation',
        `"${name}" is a method: call it with parentheses`,
      );
    }

    return undefined;
  }

  private callItems(items: NodeItems, name: string): unknown {
    if (name === 'all') return items.all();

    if (name === 'first') return items.first();

    return items.last();
  }

  private callNamespace(
    namespace: FormulaNamespace,
    name: string,
    args: unknown[],
  ): unknown {
    const methods = NAMESPACE_METHODS[namespace.name];

    const allowed = methods?.has(name);

    if (!allowed) {
      throw new FormulaError(
        'evaluation',
        `"${namespace.name}.${name}" cannot be called in a formula`,
      );
    }

    if (namespace.name === 'DateTime') {
      return this.invoke(DateTime, name, args);
    }

    const target = globalThis[
      namespace.name as keyof typeof globalThis
    ] as object;
    return this.invoke(target, name, args);
  }

  private invoke(receiver: unknown, name: string, args: unknown[]): unknown {
    const method = (receiver as Record<string, unknown>)[name] as (
      ...values: unknown[]
    ) => unknown;
    return method.apply(receiver, args);
  }

  private checkGrowth(value: string, name: string, args: unknown[]): void {
    if (name === 'repeat') {
      const count = Number(args[0]);
      const length = value.length * count;
      this.#budget.allowLength(length);
    }

    if (name === 'padStart' || name === 'padEnd') {
      const length = Number(args[0]);
      this.#budget.allowLength(length);
    }
  }
}
