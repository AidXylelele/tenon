import type {
  BulkheadFullError,
  CircuitOpenError,
  OutboundRateLimitError,
} from "@nestjs/resilience";

export type ResponseHeaders = Readonly<Record<string, string>>;

interface ProblemLocation {
  readonly pointer: string;
  readonly detail: string;
}

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly errors?: readonly ProblemLocation[];
  readonly code?: string;
  readonly current?: object;
}

export interface NestErrorBody {
  readonly message?: unknown;
  readonly code?: unknown;
}

export type Shed =
  BulkheadFullError | CircuitOpenError | OutboundRateLimitError;
