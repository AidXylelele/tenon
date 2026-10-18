import {
  type CallExpression,
  type Expression,
  type Literal,
  parseExpressionAt,
} from 'acorn';
import { DateTime } from 'luxon';
import { FormulaBudget } from './formula-budget.js';
import { FormulaError } from './formula-error.js';
import { FormulaInterpreter } from './formula-interpreter.js';
import { FormulaNamespace } from './formula-namespace.js';
import type { FormulaScope } from './formula-scope.js';
import { FormulaSyntax } from './formula-syntax.js';
import { NodeItems } from './node-items.js';

interface Embedded {
  readonly start: number;
  readonly end: number;
  readonly expression: Expression;
}

export class Formula {
  static readonly OPEN = '{{';
  static readonly CLOSE = '}}';

  readonly #source: string;
  readonly #embedded: readonly Embedded[];

  private constructor(source: string, embedded: readonly Embedded[]) {
    this.#source = source;
    this.#embedded = embedded;
  }

  static parse(source: string): Formula {
    const embedded: Embedded[] = [];
    const syntax = new FormulaSyntax();
    let cursor = source.indexOf(Formula.OPEN);

    while (cursor !== -1) {
      const start = cursor + Formula.OPEN.length;
      const expression = Formula.expressionAt(source, start);
      syntax.check(expression);
      const end = Formula.closingOf(source, expression.end);
      embedded.push({ start: cursor, end, expression });
      cursor = source.indexOf(Formula.OPEN, end);
    }

    return new Formula(source, embedded);
  }

  get source(): string {
    return this.#source;
  }

  get nodeNames(): string[] {
    const names: string[] = [];

    for (const call of this.nodeCalls()) {
      const name = String((call.arguments[0] as Literal).value);

      const seen = names.includes(name);

      if (!seen) names.push(name);
    }

    return names;
  }

  evaluate(scope: FormulaScope): unknown {
    try {
      return this.evaluated(scope);
    } catch (error) {
      throw Formula.failureOf(error);
    }
  }

  private evaluated(scope: FormulaScope): unknown {
    const budget = new FormulaBudget();
    const interpreter = new FormulaInterpreter(scope, budget);
    const only = this.#embedded.length === 1 ? this.#embedded[0] : undefined;
    const alone = only !== undefined && this.isAlone(only);

    if (alone) {
      const raw = interpreter.evaluate(only.expression);
      const value = Formula.plain(raw);
      const serializable = value ?? null;
      const json = JSON.stringify(serializable);
      budget.allowLength(json.length);
      return value;
    }

    let text = '';
    let cursor = 0;

    for (const part of this.#embedded) {
      text += this.#source.slice(cursor, part.start);
      const raw = interpreter.evaluate(part.expression);
      const value = Formula.plain(raw);
      text += FormulaInterpreter.text(value);
      budget.allowLength(text.length);
      cursor = part.end;
    }

    return text + this.#source.slice(cursor);
  }

  private static failureOf(error: unknown): FormulaError {
    if (error instanceof FormulaError) return error;

    const message = error instanceof Error ? error.message : String(error);
    const exhausted = /string length|call stack/i.test(message);

    if (error instanceof RangeError && exhausted) {
      return new FormulaError('limit', message);
    }

    return new FormulaError('evaluation', message);
  }

  renameNodes(names: ReadonlyMap<string, string>): string {
    let renamed = this.#source;
    const calls = this.nodeCalls().reverse();

    for (const call of calls) {
      const literal = call.arguments[0] as Literal;
      const to =
        typeof literal.value === 'string'
          ? names.get(literal.value)
          : undefined;

      if (to === undefined) continue;

      const quote = renamed.charAt(literal.start);
      const escaped = to
        .replaceAll('\\', '\\\\')
        .replaceAll(quote, `\\${quote}`);
      renamed =
        renamed.slice(0, literal.start) +
        quote +
        escaped +
        quote +
        renamed.slice(literal.end);
    }

    return renamed;
  }

  private isAlone(part: Embedded): boolean {
    return (
      this.#source.slice(0, part.start).trim() === '' &&
      this.#source.slice(part.end).trim() === ''
    );
  }

  private nodeCalls(): CallExpression[] {
    const calls: CallExpression[] = [];

    for (const part of this.#embedded) {
      Formula.collectNodeCalls(part.expression, calls);
    }

    return calls.sort((a, b) => a.start - b.start);
  }

  private static collectNodeCalls(
    node: unknown,
    calls: CallExpression[],
  ): void {
    if (node === null || typeof node !== 'object') return;

    const isArray = Array.isArray(node);

    if (isArray) {
      for (const child of node) Formula.collectNodeCalls(child, calls);
      return;
    }

    const candidate = node as CallExpression;
    const first = candidate.arguments?.[0];
    const literalName =
      first?.type === 'Literal' && typeof first.value === 'string';

    if (
      candidate.type === 'CallExpression' &&
      candidate.callee.type === 'Identifier' &&
      candidate.callee.name === '$' &&
      literalName
    ) {
      calls.push(candidate);
    }

    for (const [key, child] of Object.entries(node)) {
      if (key !== 'loc') Formula.collectNodeCalls(child, calls);
    }
  }

  private static expressionAt(source: string, position: number): Expression {
    try {
      return parseExpressionAt(source, position, { ecmaVersion: 'latest' });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const message = reason.replace(/ \(\d+:\d+\)$/, '');
      const failedAt = Formula.positionOf(error, position);
      throw new FormulaError('syntax', `${message} (position ${failedAt})`);
    }
  }

  private static positionOf(error: unknown, fallback: number): number {
    const position = (error as { pos?: number }).pos;
    return typeof position === 'number' ? position : fallback;
  }

  private static closingOf(source: string, from: number): number {
    let cursor = from;

    while (cursor < source.length) {
      const character = source.charAt(cursor);
      const blank = /\s/.test(character);

      if (!blank) break;

      cursor += 1;
    }

    const closed = source.startsWith(Formula.CLOSE, cursor);

    if (!closed) {
      throw new FormulaError(
        'syntax',
        `Expected "}}" to close the expression (position ${cursor})`,
      );
    }

    return cursor + Formula.CLOSE.length;
  }

  private static plain(value: unknown): unknown {
    if (value instanceof DateTime) return value.toISO();

    if (value instanceof NodeItems || value instanceof FormulaNamespace) {
      throw new FormulaError('evaluation', 'The formula result is not a value');
    }

    return value;
  }
}
