import type { JsonValue } from "../../api/index.js";
import type { ConsumptionKind } from "../../standard/index.js";
import type {
  Duration,
  Export,
  Expression,
  Output,
  TextTemplate,
  ValueTemplate,
} from "./data.js";
import type { TaskList } from "./tasks.js";

export interface EventProperties {
  readonly pointer: string;
  readonly id: TextTemplate | null;
  readonly source: TextTemplate | null;
  readonly type: TextTemplate | null;
  readonly time: TextTemplate | null;
  readonly subject: TextTemplate | null;
  readonly datacontenttype: TextTemplate | null;
  readonly dataschema: TextTemplate | null;
  readonly data: ValueTemplate | null;
  readonly additional: ReadonlyMap<string, ValueTemplate>;
}

export interface PatternAttribute {
  readonly kind: "pattern";
  readonly pointer: string;
  readonly pattern: string;
}

interface ConditionAttribute {
  readonly kind: "condition";
  readonly pointer: string;
  readonly condition: Expression;
}

interface ValueAttribute {
  readonly kind: "value";
  readonly pointer: string;
  readonly value: JsonValue;
}

export type FilterAttribute =
  PatternAttribute | ConditionAttribute | ValueAttribute;

export interface FilterProperties {
  readonly pointer: string;
  readonly attributes: ReadonlyMap<string, FilterAttribute>;
}

export interface EventFilter {
  readonly pointer: string;
  readonly with: FilterProperties;
  readonly correlate: ReadonlyMap<string, Correlation>;
}

export interface Correlation {
  readonly pointer: string;
  readonly from: Expression;
  readonly expect: TextTemplate | null;
}

interface AllEventConsumption {
  readonly kind: "all";
  readonly pointer: string;
  readonly filters: readonly EventFilter[];
}

export interface AnyEventConsumption {
  readonly kind: "any";
  readonly pointer: string;
  readonly filters: readonly EventFilter[];
  readonly until: Expression | ConsumptionStrategy | null;
}

interface OneEventConsumption {
  readonly kind: "one";
  readonly pointer: string;
  readonly filter: EventFilter;
}

interface ConsumptionStrategies {
  readonly all: AllEventConsumption;
  readonly any: AnyEventConsumption;
  readonly one: OneEventConsumption;
}

export type ConsumptionStrategy = ConsumptionStrategies[ConsumptionKind];

export interface SubscriptionIterator {
  readonly pointer: string;
  readonly item: string;
  readonly at: string;
  readonly do: TaskList | null;
  readonly output: Output;
  readonly export: Export;
}

export interface AsyncApiMessageExchange {
  readonly kind: "message";
  readonly pointer: string;
  readonly payload: ValueTemplate | null;
  readonly headers: ValueTemplate | null;
}

export interface AsyncApiSubscriptionExchange {
  readonly kind: "subscription";
  readonly pointer: string;
  readonly filter: Expression | null;
  readonly consume: SubscriptionLifetime;
  readonly foreach: SubscriptionIterator | null;
}

interface AmountLifetime {
  readonly kind: "amount";
  readonly pointer: string;
  readonly amount: number;
  readonly for: Duration | null;
}

interface WhileLifetime {
  readonly kind: "while";
  readonly pointer: string;
  readonly while: Expression;
  readonly for: Duration | null;
}

interface UntilLifetime {
  readonly kind: "until";
  readonly pointer: string;
  readonly until: Expression;
  readonly for: Duration | null;
}

export type SubscriptionLifetime =
  AmountLifetime | WhileLifetime | UntilLifetime;
