import type {
  BinaryExpression,
  CallExpression,
  Expression,
  MemberExpression,
  ObjectExpression,
  PrivateIdentifier,
  SpreadElement,
  Super,
  TemplateLiteral,
} from 'acorn';
import { DateTime } from 'luxon';
import type { FormulaBudget } from './formula-budget.js';
import { FormulaError } from './formula-error.js';
import { FormulaMethods } from './formula-methods.js';
import type { FormulaScope } from './formula-scope.js';

const SHORT_CIRCUIT = Symbol('short-circuit');

type Evaluable = Expression | SpreadElement | Super | PrivateIdentifier;

export class FormulaInterpreter {
  readonly #scope: FormulaScope;
  readonly #budget: FormulaBudget;
  readonly #methods: FormulaMethods;

  constructor(scope: FormulaScope, budget: FormulaBudget) {
    this.#scope = scope;
    this.#budget = budget;
    this.#methods = new FormulaMethods(budget, scope);
  }

  evaluate(node: Evaluable): unknown {
    this.#budget.tick();

    switch (node.type) {
      case 'Literal':
        return node.value;
      case 'Identifier':
        return this.#scope.resolve(node.name);
      case 'TemplateLiteral':
        return this.template(node);
      case 'MemberExpression':
        return this.member(node);
      case 'CallExpression':
        return this.call(node);
      case 'ChainExpression': {
        const value = this.chainLink(node.expression);
        return value === SHORT_CIRCUIT ? undefined : value;
      }
      case 'UnaryExpression': {
        const operand = this.evaluate(node.argument);
        return this.unary(node.operator, operand);
      }
      case 'BinaryExpression':
        return this.binary(node);
      case 'LogicalExpression':
        return this.logical(node.operator, node.left, node.right);
      case 'ConditionalExpression': {
        const condition = this.evaluate(node.test);
        return condition
          ? this.evaluate(node.consequent)
          : this.evaluate(node.alternate);
      }
      case 'ArrayExpression':
        return this.array(node.elements);
      case 'ObjectExpression':
        return this.object(node);
      default:
        throw new FormulaError(
          'evaluation',
          `${node.type} cannot be evaluated in a formula`,
        );
    }
  }

  private chainLink(node: Evaluable): unknown {
    if (node.type === 'MemberExpression') return this.member(node);

    if (node.type === 'CallExpression') return this.call(node);

    return this.evaluate(node);
  }

  private member(node: MemberExpression): unknown {
    const object = this.chainLink(node.object);

    if (object === SHORT_CIRCUIT) return SHORT_CIRCUIT;

    if (node.optional && (object === null || object === undefined)) {
      return SHORT_CIRCUIT;
    }

    const name = this.propertyName(node);
    return this.#methods.property(object, name);
  }

  private call(node: CallExpression): unknown {
    const args = this.arguments(node);

    if (node.callee.type === 'Identifier') {
      return this.#methods.callFunction(node.callee.name, args);
    }

    const callee = node.callee as MemberExpression;
    const receiver = this.chainLink(callee.object);

    if (receiver === SHORT_CIRCUIT) return SHORT_CIRCUIT;

    const absent = receiver === null || receiver === undefined;

    if (absent && (callee.optional || node.optional)) return SHORT_CIRCUIT;

    const name = this.propertyName(callee);
    return this.#methods.call(receiver, name, args);
  }

  private arguments(node: CallExpression): unknown[] {
    const args: unknown[] = [];

    for (const argument of node.arguments) {
      const value = this.evaluate(argument);
      args.push(value);
    }

    return args;
  }

  private propertyName(node: MemberExpression): string {
    if (!node.computed && node.property.type === 'Identifier') {
      return node.property.name;
    }

    const key = this.evaluate(node.property);
    return String(key);
  }

  private template(node: TemplateLiteral): string {
    let text = '';

    for (let index = 0; index < node.quasis.length; index++) {
      text += node.quasis[index]!.value.cooked ?? '';
      const expression = node.expressions[index];

      if (expression) {
        const value = this.evaluate(expression);
        text += FormulaInterpreter.text(value);
      }
    }

    this.#budget.allowLength(text.length);
    return text;
  }

  private unary(operator: string, value: unknown): unknown {
    switch (operator) {
      case '-':
        return -(value as number);
      case '+':
        return +(value as number);
      case '!':
        return !value;
      case '~':
        return ~(value as number);
      default:
        return typeof value;
    }
  }

  private binary(node: BinaryExpression): unknown {
    const left = this.evaluate(node.left) as never;
    const right = this.evaluate(node.right) as never;
    const result = FormulaInterpreter.operate(node.operator, left, right);

    if (typeof result === 'string') this.#budget.allowLength(result.length);

    return result;
  }

  private static operate(operator: string, left: never, right: never): unknown {
    switch (operator) {
      case '+':
        return FormulaInterpreter.add(left, right);
      case '-':
        return left - right;
      case '*':
        return left * right;
      case '/':
        return left / right;
      case '%':
        return left % right;
      case '**':
        return left ** right;
      case '==':
        return left == right;
      case '!=':
        return left != right;
      case '===':
        return left === right;
      case '!==':
        return left !== right;
      case '<':
        return left < right;
      case '<=':
        return left <= right;
      case '>':
        return left > right;
      case '>=':
        return left >= right;
      case '<<':
        return left << right;
      case '>>':
        return left >> right;
      case '>>>':
        return left >>> right;
      case '|':
        return left | right;
      case '&':
        return left & right;
      default:
        return left ^ right;
    }
  }

  private static add(left: unknown, right: unknown): unknown {
    if (typeof left === 'string' || typeof right === 'string') {
      return FormulaInterpreter.text(left) + FormulaInterpreter.text(right);
    }

    return Number(left) + Number(right);
  }

  private logical(
    operator: string,
    left: Expression,
    right: Expression,
  ): unknown {
    const value = this.evaluate(left);

    if (operator === '&&') return value ? this.evaluate(right) : value;

    if (operator === '||') return value ? value : this.evaluate(right);

    return value ?? this.evaluate(right);
  }

  private array(
    elements: readonly (Expression | SpreadElement | null)[],
  ): unknown[] {
    const values: unknown[] = [];

    for (const element of elements) {
      if (element === null) {
        values.push(undefined);
        continue;
      }

      if (element.type === 'SpreadElement') {
        const spread = this.evaluate(element.argument) as unknown[];
        values.push(...spread);
        continue;
      }

      const value = this.evaluate(element);
      values.push(value);
    }

    return values;
  }

  private static spread(
    target: Record<string, unknown>,
    source: unknown,
  ): void {
    if (source === null || source === undefined) return;

    for (const [key, entry] of Object.entries(source)) {
      Object.defineProperty(target, key, {
        value: entry,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }

  private object(node: ObjectExpression): Record<string, unknown> {
    const value: Record<string, unknown> = {};

    for (const property of node.properties) {
      if (property.type === 'SpreadElement') {
        const source = this.evaluate(property.argument);
        FormulaInterpreter.spread(value, source);
        continue;
      }

      let key: string;

      if (!property.computed && property.key.type === 'Identifier') {
        key = property.key.name;
      } else {
        const evaluated = this.evaluate(property.key);
        key = String(evaluated);
      }

      const entry = this.evaluate(property.value);
      Object.defineProperty(value, key, {
        value: entry,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }

    return value;
  }

  static text(value: unknown): string {
    if (value === undefined || value === null) return '';

    if (typeof value === 'string') return value;

    if (value instanceof DateTime) return value.toISO() ?? '';

    if (typeof value === 'object') return JSON.stringify(value);

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return '';
  }
}
