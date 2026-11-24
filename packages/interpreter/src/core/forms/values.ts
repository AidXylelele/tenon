import type { JsonValue } from "../../api/index.js";
import type { UriTemplate } from "../../runtime/index.js";
import type { BinderRole } from "../../semantics/index.js";
import type { ExpressionMode, RuntimeArgument } from "../../standard/index.js";
import type { ResourceTemplate } from "./effects.js";
import type { TermId } from "./ids.js";

export interface SlotAccess {
  readonly kind: "slot";
  readonly depth: number;
  readonly index: number;
}

type ActivationArgument = Extract<RuntimeArgument, "task" | "authorization">;

type RunArgument = Extract<RuntimeArgument, "workflow" | "runtime">;

export interface ActivationAccess {
  readonly kind: "activation";
  readonly hops: number;
  readonly field: ActivationArgument;
}

export interface StoreAccess {
  readonly kind: "store";
}

export interface RunAccess {
  readonly kind: "run";
  readonly field: RunArgument;
}

export interface SecretsAccess {
  readonly kind: "secrets";
}

export type Access =
  SlotAccess | ActivationAccess | StoreAccess | RunAccess | SecretsAccess;

export interface Argument {
  readonly name: string;
  readonly access: Access;
}

export interface Expression {
  readonly kind: "expression";
  readonly id: TermId;
  readonly source: string;
  readonly mode: ExpressionMode;
  readonly arguments: readonly Argument[];
}

export interface Literal {
  readonly kind: "literal";
  readonly value: JsonValue;
}

export interface ObjectTemplate {
  readonly kind: "object";
  readonly fields: ReadonlyMap<string, Template>;
}

export interface ArrayTemplate {
  readonly kind: "array";
  readonly items: readonly Template[];
}

export interface CurrentValue {
  readonly kind: "current";
}

export interface StoredContext {
  readonly kind: "context";
}

export type Template =
  | Literal
  | Expression
  | ObjectTemplate
  | ArrayTemplate
  | CurrentValue
  | StoredContext;

export interface UriTemplateTerm {
  readonly kind: "uri";
  readonly template: UriTemplate;
}

export type UriTerm = UriTemplateTerm | Expression;

export interface OmittedPart {
  readonly kind: "omitted";
}

export interface WrittenPart {
  readonly kind: "written";
  readonly template: Template;
}

export type OptionalPart = OmittedPart | WrittenPart;

export interface FixedDuration {
  readonly kind: "fixed";
  readonly milliseconds: number;
}

export interface CalendarDuration {
  readonly kind: "calendar";
  readonly iso: string;
}

export interface ComputedDuration {
  readonly kind: "computed";
  readonly expression: Expression;
}

export type DurationTerm = FixedDuration | CalendarDuration | ComputedDuration;

export interface CompiledSchema {
  readonly kind: "compiled";
  readonly id: TermId;
}

export interface FetchedSchema {
  readonly kind: "fetched";
  readonly id: TermId;
  readonly resource: ResourceTemplate;
}

export type SchemaTerm = CompiledSchema | FetchedSchema;

export interface BinderSlot {
  readonly name: string;
  readonly role: BinderRole;
}

export interface Binders {
  readonly declaration: string;
  readonly slots: readonly BinderSlot[];
}

export type SlotArgument = Extract<RuntimeArgument, "input" | "output">;

export interface ArgumentMeaning {
  readonly kind: "argument";
  readonly argument: SlotArgument;
}

export interface BinderMeaning {
  readonly kind: "binder";
  readonly declaration: string;
  readonly role: BinderRole;
}

export type SlotMeaning = ArgumentMeaning | BinderMeaning;
