import type { ResiliencePreset } from "@nestjs/resilience";
import type { OutboxMessage, OutboxRetryOptions } from "@nestjs/outbox";
import {
  HostLimits,
  ProcessPlatform,
} from "../../application/automation/host/queries.js";
import { SandboxLimits } from "../../interface-adapters/sandbox/sandbox-limits.js";
import shellPlatform from "../go-judge/shell-platform.json" with { type: "json" };
import { DeliveryHandler } from "../../interface-adapters/messaging/delivery.handler.js";
import { MessageTopic } from "../../interface-adapters/messaging/enums.js";
import type { InterpreterThreads } from "../interpreter/interfaces.js";
import { ResponseSizeLimit } from "../http/response-size-limit.js";

const CALL_SECONDS = 30;
const PROCESS_SECONDS = 35;
const MILLISECONDS = 1_000;
const CALL_TIMEOUT = CALL_SECONDS * MILLISECONDS;
const PROCESS_TIMEOUT = PROCESS_SECONDS * MILLISECONDS;
const INTERPRETER_WORK = 5 * MILLISECONDS;
const INTERPRETER_QUEUE_TIMEOUT = 2 * MILLISECONDS;
const INTERPRETER_TIMEOUT = INTERPRETER_WORK + INTERPRETER_QUEUE_TIMEOUT;
const RUN_BACKOFF_CAP = 60 * MILLISECONDS;
const DELIVERY_BACKOFF_CAP = 60 * 60 * MILLISECONDS;
const DELIVERY_TOPIC: string = MessageTopic.DeliveryRequested;
const RESPONSE_BYTES = 1024 * 1024;
const SANDBOX_TIME = Temporal.Duration.from({ seconds: 30 });
const SANDBOX_MEMORY_BYTES = 256 * 1024 * 1024;
const SANDBOX_OUTPUT_BYTES = 1024 * 1024;

export const responseSizeLimit = new ResponseSizeLimit(RESPONSE_BYTES);

export const hostLimits = new HostLimits(
  CALL_SECONDS,
  PROCESS_SECONDS,
  responseSizeLimit.bytes,
);

export const processPlatform = new ProcessPlatform(shellPlatform);

export const sandboxLimits = new SandboxLimits({
  time: SANDBOX_TIME,
  memoryBytes: SANDBOX_MEMORY_BYTES,
  processes: 50,
  outputBytes: SANDBOX_OUTPUT_BYTES,
});

function backoffCapOf(message: OutboxMessage): number {
  if (message.topic === DELIVERY_TOPIC) return DELIVERY_BACKOFF_CAP;

  return RUN_BACKOFF_CAP;
}

export const relayRetry: OutboxRetryOptions = {
  attempts: DeliveryHandler.ATTEMPTS,
  backoff: (attempt, _error, message) => {
    const cap = backoffCapOf(message);
    const doubled = MILLISECONDS * 2 ** (attempt - 1);
    const delay = Math.min(cap, doubled);
    const jitter = Math.random() * (delay / 2);
    return delay / 2 + jitter;
  },
};

export const resiliencePresets: Readonly<Record<string, ResiliencePreset>> = {
  "service-calls": {
    timeout: CALL_TIMEOUT,
    bulkhead: { maxConcurrent: 64, maxQueue: 0 },
  },
  "grpc-calls": {
    timeout: CALL_TIMEOUT,
    bulkhead: { maxConcurrent: 32, maxQueue: 0 },
  },
  "mcp-calls": {
    timeout: CALL_TIMEOUT,
    bulkhead: { maxConcurrent: 32, maxQueue: 0 },
  },
  "a2a-calls": {
    timeout: CALL_TIMEOUT,
    bulkhead: { maxConcurrent: 32, maxQueue: 0 },
  },
  "asyncapi-calls": {
    timeout: CALL_TIMEOUT,
    bulkhead: { maxConcurrent: 32, maxQueue: 0 },
  },
  processes: {
    timeout: PROCESS_TIMEOUT,
    circuitBreaker: {
      failureRateThreshold: 50,
      minimumCalls: 10,
      openDuration: "30s",
    },
    bulkhead: { maxConcurrent: 8, maxQueue: 0 },
  },
};

export const interpreterPresetsOf = (
  threads: InterpreterThreads,
): Readonly<Record<string, ResiliencePreset>> => ({
  interpreter: {
    timeout: INTERPRETER_TIMEOUT,
    bulkhead: {
      maxConcurrent: threads.runs,
      maxQueue: threads.runs ** 2,
      queueTimeout: INTERPRETER_QUEUE_TIMEOUT,
    },
  },
  "interpreter-checks": {
    timeout: INTERPRETER_TIMEOUT,
    bulkhead: {
      maxConcurrent: threads.checks,
      maxQueue: threads.checks ** 2,
      queueTimeout: INTERPRETER_QUEUE_TIMEOUT,
    },
  },
});
