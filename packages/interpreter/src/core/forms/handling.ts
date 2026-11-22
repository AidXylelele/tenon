import type { JsonObject } from "../../api/index.js";
import type { BackoffKind } from "../../standard/index.js";
import type { Term } from "./terms.js";
import type { Binders, DurationTerm, Expression } from "./values.js";

export interface MatchTest {
  readonly kind: "match";
  readonly filter: JsonObject;
}

export interface WhenTest {
  readonly kind: "when";
  readonly condition: Expression;
}

export interface ExceptWhenTest {
  readonly kind: "exceptWhen";
  readonly condition: Expression;
}

export type CatchTest = MatchTest | WhenTest | ExceptWhenTest;

export interface Recover {
  readonly kind: "recover";
  readonly body: Term;
}

export interface Reraise {
  readonly kind: "reraise";
}

export type Recovery = Recover | Reraise;

export interface Catch {
  readonly tests: readonly CatchTest[];
  readonly binders: Binders;
  readonly recovery: Recovery;
}

export interface NoRetry {
  readonly kind: "never";
}

export interface UnboundedAttempts {
  readonly kind: "unbounded";
}

export interface CountedAttempts {
  readonly kind: "count";
  readonly count: number;
}

export interface UnlimitedDuration {
  readonly kind: "unlimited";
}

export interface WithinDuration {
  readonly kind: "within";
  readonly duration: DurationTerm;
}

export type TimeLimit = UnlimitedDuration | WithinDuration;

export interface NoDelay {
  readonly kind: "noDelay";
}

export type Delay = NoDelay | DurationTerm;

export interface NoJitter {
  readonly kind: "noJitter";
}

export interface JitterRange {
  readonly kind: "range";
  readonly from: DurationTerm;
  readonly to: DurationTerm;
}

export type Jitter = NoJitter | JitterRange;

export interface RetryPolicy {
  readonly kind: "policy";
  readonly tests: readonly (WhenTest | ExceptWhenTest)[];
  readonly delay: Delay;
  readonly backoff: BackoffKind;
  readonly attempts: UnboundedAttempts | CountedAttempts;
  readonly attempt: TimeLimit;
  readonly duration: TimeLimit;
  readonly jitter: Jitter;
}

export type Retry = NoRetry | RetryPolicy;
