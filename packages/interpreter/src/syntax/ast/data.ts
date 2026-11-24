import type { JsonValue } from "../../api/index.js";
import type { ExpressionMode } from "../../standard/index.js";
import type { ExternalResource } from "./endpoints.js";

export interface Expression {
  readonly kind: "expression";
  readonly pointer: string;
  readonly source: string;
  readonly sourceOffset: number;
  readonly mode: ExpressionMode;
}

interface Literal {
  readonly kind: "literal";
  readonly pointer: string;
  readonly value: JsonValue;
}

interface StringLiteral {
  readonly kind: "literal";
  readonly pointer: string;
  readonly value: string;
}

export interface ObjectTemplate {
  readonly kind: "object";
  readonly pointer: string;
  readonly fields: ReadonlyMap<string, ValueTemplate>;
}

export interface ArrayTemplate {
  readonly kind: "array";
  readonly pointer: string;
  readonly items: readonly ValueTemplate[];
}

export type ValueTemplate =
  Literal | Expression | ObjectTemplate | ArrayTemplate;

export type TextTemplate = StringLiteral | Expression;

interface FixedDuration {
  readonly kind: "fixed";
  readonly pointer: string;
  readonly milliseconds: number;
}

interface CalendarDuration {
  readonly kind: "calendar";
  readonly pointer: string;
  readonly iso: string;
}

export interface ComputedDuration {
  readonly kind: "computed";
  readonly pointer: string;
  readonly expression: Expression;
}

interface InvalidDuration {
  readonly kind: "invalid";
  readonly pointer: string;
  readonly text: string;
}

export type Duration =
  FixedDuration | CalendarDuration | ComputedDuration | InvalidDuration;

export interface InlineSchema {
  readonly kind: "inline";
  readonly pointer: string;
  readonly format: string;
  readonly document: JsonValue;
}

export interface ExternalSchema {
  readonly kind: "external";
  readonly pointer: string;
  readonly format: string;
  readonly resource: ExternalResource;
}

export type Schema = InlineSchema | ExternalSchema;

export interface Input {
  readonly pointer: string;
  readonly schema: Schema | null;
  readonly from: ValueTemplate | null;
}

export interface Output {
  readonly pointer: string;
  readonly schema: Schema | null;
  readonly as: ValueTemplate | null;
}

export interface Export {
  readonly pointer: string;
  readonly schema: Schema | null;
  readonly as: ValueTemplate | null;
}

export interface Reference {
  readonly kind: "reference";
  readonly pointer: string;
  readonly name: string;
}
