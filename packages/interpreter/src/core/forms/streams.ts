import type { JsonValue } from "../../api/index.js";
import type { ReadMode } from "../../standard/index.js";
import type { AsyncApiRequestTemplate } from "./effects.js";
import type { TermId } from "./ids.js";
import type { Term } from "./terms.js";
import type { Binders, DurationTerm, Expression, Template } from "./values.js";

export interface Expected {
  readonly kind: "expected";
  readonly value: Template;
}

export interface FirstSeen {
  readonly kind: "firstSeen";
}

export interface CorrelationTemplate {
  readonly key: string;
  readonly from: Expression;
  readonly expect: Expected | FirstSeen;
}

export interface PatternTest {
  readonly kind: "pattern";
  readonly id: TermId;
  readonly pattern: string;
}

export interface EqualsTest {
  readonly kind: "equals";
  readonly value: JsonValue;
}

export interface ConditionTest {
  readonly kind: "condition";
  readonly condition: Expression;
}

export type AttributeTest = PatternTest | EqualsTest | ConditionTest;

export interface HeldVerdict {
  readonly kind: "held";
}

export interface FailedVerdict {
  readonly kind: "failed";
}

export interface ConditionalVerdict {
  readonly kind: "conditional";
  readonly condition: Expression;
  readonly value: JsonValue;
}

export type AttributeVerdict = HeldVerdict | FailedVerdict | ConditionalVerdict;

export interface FilterAt {
  readonly level: number;
  readonly filter: number;
}

export interface FilterTemplate {
  readonly at: FilterAt;
  readonly with: ReadonlyMap<string, AttributeTest>;
  readonly correlate: readonly CorrelationTemplate[];
}

export interface OneStrategy {
  readonly kind: "one";
  readonly filter: FilterTemplate;
}

export interface AllStrategy {
  readonly kind: "all";
  readonly filters: readonly FilterTemplate[];
}

export interface UntilFirst {
  readonly kind: "first";
}

export interface UntilCondition {
  readonly kind: "condition";
  readonly condition: Expression;
}

export interface UntilStrategy {
  readonly kind: "strategy";
  readonly strategy: StrategyTemplate;
}

export interface AnyStrategy {
  readonly kind: "any";
  readonly filters: readonly FilterTemplate[];
  readonly until: UntilFirst | UntilCondition | UntilStrategy;
}

export type StrategyTemplate = OneStrategy | AllStrategy | AnyStrategy;

export interface NothingBelow {
  readonly kind: "none";
}

export interface ListenSource {
  readonly kind: "listen";
  readonly strategy: StrategyTemplate;
  readonly read: ReadMode;
}

export interface SubscriptionSource {
  readonly kind: "subscription";
  readonly request: AsyncApiRequestTemplate;
  readonly filters: readonly Expression[];
}

export type StreamSource = ListenSource | SubscriptionSource;

export interface OpenWindow {
  readonly kind: "open";
}

export interface ClosesAfter {
  readonly kind: "closesAfter";
  readonly duration: DurationTerm;
}

export type Window = OpenWindow | ClosesAfter;

export interface StopConsumption {
  readonly kind: "consumption";
}

export interface StopAmount {
  readonly kind: "amount";
  readonly amount: number;
  readonly window: Window;
}

export interface StopWhile {
  readonly kind: "while";
  readonly condition: Expression;
  readonly window: Window;
}

export interface StopUntil {
  readonly kind: "until";
  readonly condition: Expression;
  readonly window: Window;
}

export type Stop = StopConsumption | StopAmount | StopWhile | StopUntil;

export interface Iterator {
  readonly binders: Binders;
  readonly each: Term;
}
