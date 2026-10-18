import type {
  ArrayExpression,
  CallExpression,
  Expression,
  MemberExpression,
  ObjectExpression,
  PrivateIdentifier,
  SpreadElement,
  Super,
} from 'acorn';
import { FormulaError } from './formula-error.js';
import { FormulaScope } from './formula-scope.js';

const UNARY = new Set(['-', '+', '!', '~', 'typeof']);
const BINARY_REFUSED = new Set(['in', 'instanceof']);

export class FormulaSyntax {
  check(node: Expression | SpreadElement | Super | PrivateIdentifier): void {
    switch (node.type) {
      case 'Literal':
        if (node.regex || node.bigint) this.refuse(node.type, node.start);
        return;
      case 'Identifier': {
        const known = FormulaScope.knows(node.name);

        if (!known) {
          throw new FormulaError(
            'scope',
            `"${node.name}" is not available in formulas (position ${node.start})`,
          );
        }
        return;
      }
      case 'TemplateLiteral':
        node.expressions.forEach((expression) => this.check(expression));
        return;
      case 'MemberExpression':
        this.member(node);
        return;
      case 'ChainExpression':
        this.check(node.expression);
        return;
      case 'CallExpression':
        this.call(node);
        return;
      case 'UnaryExpression': {
        const allowed = UNARY.has(node.operator);

        if (!allowed) this.refuse(node.operator, node.start);
        this.check(node.argument);
        return;
      }
      case 'BinaryExpression': {
        const refused = BINARY_REFUSED.has(node.operator);

        if (refused) {
          this.refuse(node.operator, node.start);
        }
        this.check(node.left);
        this.check(node.right);
        return;
      }
      case 'LogicalExpression':
        this.check(node.left);
        this.check(node.right);
        return;
      case 'ConditionalExpression':
        this.check(node.test);
        this.check(node.consequent);
        this.check(node.alternate);
        return;
      case 'ArrayExpression':
        this.array(node);
        return;
      case 'ObjectExpression':
        this.object(node);
        return;
      case 'SpreadElement':
        this.check(node.argument);
        return;
      default:
        this.refuse(node.type, node.start);
    }
  }

  private member(node: MemberExpression): void {
    this.check(node.object);

    if (node.computed) this.check(node.property);
  }

  private call(node: CallExpression): void {
    if (
      node.callee.type !== 'MemberExpression' &&
      node.callee.type !== 'Identifier'
    ) {
      this.refuse('a call of a computed function', node.start);
    }

    this.check(node.callee);

    for (const argument of node.arguments) {
      if (argument.type === 'SpreadElement') {
        this.refuse('a spread argument', argument.start);
      }

      this.check(argument);
    }
  }

  private array(node: ArrayExpression): void {
    for (const element of node.elements) {
      if (element) this.check(element);
    }
  }

  private object(node: ObjectExpression): void {
    for (const property of node.properties) {
      if (property.type === 'SpreadElement') {
        this.check(property);
        continue;
      }

      if (property.kind !== 'init' || property.method) {
        this.refuse('a getter, setter or method', property.start);
      }

      if (property.computed) this.check(property.key);

      this.check(property.value);
    }
  }

  private refuse(construct: string, position: number): never {
    throw new FormulaError(
      'syntax',
      `${construct} is not allowed in formulas (position ${position})`,
    );
  }
}
