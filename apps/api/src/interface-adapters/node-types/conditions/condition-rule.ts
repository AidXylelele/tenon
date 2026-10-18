import { DateTime } from 'luxon';
import type { Condition } from './conditions-schema.js';
import type { Operator } from './operators.js';
import { RegularExpression } from './regular-expression.js';

export class ConditionRule {
  readonly #left: unknown;
  readonly #operator: Operator;
  readonly #right: unknown;
  readonly #ignoreCase: boolean;

  constructor(condition: Condition, ignoreCase: boolean) {
    this.#left = condition.left;
    this.#operator = condition.operator;
    this.#right = condition.right;
    this.#ignoreCase = ignoreCase;
  }

  holds(): boolean {
    const [kind, operation] = this.#operator.split(':');

    if (operation === undefined) return this.existence(kind!);

    if (kind === 'string') return this.text(operation);

    if (kind === 'number') return this.number(operation);

    if (kind === 'date') return this.date(operation);

    if (kind === 'boolean') return this.boolean(operation);

    if (kind === 'array') return this.list(operation);

    return this.object(operation);
  }

  private existence(operation: string): boolean {
    const exists = this.#left !== undefined && this.#left !== null;
    return operation === 'exists' ? exists : !exists;
  }

  private text(operation: string): boolean {
    const leftText = ConditionRule.textOf(this.#left);
    const left = this.caseOf(leftText);
    const rightText = ConditionRule.textOf(this.#right);
    const right = this.caseOf(rightText);

    switch (operation) {
      case 'equals':
        return left === right;
      case 'notEquals':
        return left !== right;
      case 'contains':
        return left.includes(right);
      case 'notContains':
        return !left.includes(right);
      case 'startsWith':
        return left.startsWith(right);
      case 'endsWith':
        return left.endsWith(right);
      case 'matches':
        return this.matches();
      case 'notMatches':
        return !this.matches();
      case 'isEmpty':
        return left === '';
      default:
        return left !== '';
    }
  }

  private matches(): boolean {
    const source = ConditionRule.textOf(this.#right);
    const pattern = RegularExpression.compile(source, this.#ignoreCase);
    const text = ConditionRule.textOf(this.#left);
    return pattern.test(text);
  }

  private number(operation: string): boolean {
    const left = ConditionRule.numberOf(this.#left);
    const right = ConditionRule.numberOf(this.#right);

    if (left === null || right === null) return false;

    switch (operation) {
      case 'equals':
        return left === right;
      case 'notEquals':
        return left !== right;
      case 'gt':
        return left > right;
      case 'gte':
        return left >= right;
      case 'lt':
        return left < right;
      default:
        return left <= right;
    }
  }

  private date(operation: string): boolean {
    const left = ConditionRule.dateOf(this.#left);
    const right = ConditionRule.dateOf(this.#right);

    if (left === null || right === null) return false;

    if (operation === 'after') return left > right;

    if (operation === 'before') return left < right;

    return left === right;
  }

  private boolean(operation: string): boolean {
    return operation === 'isTrue' ? this.#left === true : this.#left === false;
  }

  private list(operation: string): boolean {
    const isArray = Array.isArray(this.#left);

    if (!isArray) return false;

    const length = ConditionRule.numberOf(this.#right);

    switch (operation) {
      case 'contains':
        return this.#left.includes(this.#right);
      case 'notContains':
        return !this.#left.includes(this.#right);
      case 'lengthEquals':
        return this.#left.length === length;
      case 'lengthGt':
        return length !== null && this.#left.length > length;
      case 'lengthLt':
        return length !== null && this.#left.length < length;
      case 'isEmpty':
        return this.#left.length === 0;
      default:
        return this.#left.length > 0;
    }
  }

  private object(operation: string): boolean {
    const value = this.#left;
    const isArray = Array.isArray(value);

    if (value === null || typeof value !== 'object' || isArray) {
      return false;
    }

    const empty = Object.keys(value).length === 0;
    return operation === 'isEmpty' ? empty : !empty;
  }

  private caseOf(text: string): string {
    return this.#ignoreCase ? text.toLowerCase() : text;
  }

  private static textOf(value: unknown): string {
    if (value === undefined || value === null) return '';

    if (typeof value === 'string') return value;

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return JSON.stringify(value);
  }

  private static numberOf(value: unknown): number | null {
    if (typeof value === 'number') {
      const finite = Number.isFinite(value);
      return finite ? value : null;
    }

    if (typeof value !== 'string') return null;

    const trimmed = value.trim();

    if (trimmed === '') return null;

    const number = Number(value);
    const valid = Number.isFinite(number);
    return valid ? number : null;
  }

  private static dateOf(value: unknown): number | null {
    const text = ConditionRule.textOf(value);
    const date =
      typeof value === 'number'
        ? DateTime.fromMillis(value)
        : DateTime.fromISO(text, { setZone: true });
    return date.isValid ? date.toMillis() : null;
  }
}
