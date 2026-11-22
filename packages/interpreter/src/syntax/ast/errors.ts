import type { BackoffKind } from "../../standard/index.js";
import type { Duration, Expression, Reference, TextTemplate } from "./data.js";
import type { Directive } from "./flow.js";
import type { TaskList } from "./tasks.js";

export interface ErrorDefinition {
  readonly kind: "error";
  readonly pointer: string;
  readonly type: TextTemplate;
  readonly status: number;
  readonly instance: TextTemplate | null;
  readonly title: TextTemplate | null;
  readonly detail: TextTemplate | null;
}

export interface ErrorFilter {
  readonly pointer: string;
  readonly type: string | null;
  readonly status: number | null;
  readonly instance: string | null;
  readonly title: string | null;
  readonly detail: string | null;
}

export interface Catch {
  readonly pointer: string;
  readonly errors: ErrorFilter | null;
  readonly as: string;
  readonly when: Expression | null;
  readonly exceptWhen: Expression | null;
  readonly retry: RetryPolicy | Reference | null;
  readonly do: TaskList | null;
  readonly then: Directive | null;
}

export interface RetryPolicy {
  readonly kind: "retry";
  readonly pointer: string;
  readonly when: Expression | null;
  readonly exceptWhen: Expression | null;
  readonly delay: Duration | null;
  readonly backoff: Backoff;
  readonly limit: RetryLimit;
  readonly jitter: Jitter | null;
}

export interface Backoff {
  readonly kind: BackoffKind;
  readonly pointer: string;
}

export interface RetryLimit {
  readonly pointer: string;
  readonly attempt: AttemptLimit;
  readonly duration: Duration | null;
}

export interface AttemptLimit {
  readonly pointer: string;
  readonly count: number | null;
  readonly duration: Duration | null;
}

export interface Jitter {
  readonly pointer: string;
  readonly from: Duration;
  readonly to: Duration;
}

export interface Timeout {
  readonly kind: "timeout";
  readonly pointer: string;
  readonly after: Duration;
}
