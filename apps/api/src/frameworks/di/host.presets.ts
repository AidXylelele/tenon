import type { ResiliencePreset } from "@nestjs/resilience";
import type { WorkflowRetryOptions } from "@nestjs/workflows";
import {
  HostLimits,
  ProcessPlatform,
} from "../../application/automation/host/queries.js";
import { SandboxLimits } from "../../interface-adapters/workflows/effects/sandbox-limits.js";
import shellPlatform from "../go-judge/shell-platform.json" with { type: "json" };
import { PiscinaInterpreterClient } from "../interpreter/piscina-interpreter.client.js";
import { ResponseSizeLimit } from "../network/response-size-limit.js";

const CALL_SECONDS = 30;
const PROCESS_SECONDS = 35;
const MILLISECONDS = 1_000;
const CALL_TIMEOUT = CALL_SECONDS * MILLISECONDS;
const PROCESS_TIMEOUT = PROCESS_SECONDS * MILLISECONDS;
const INTERPRETER_WORK = 5 * MILLISECONDS;
const INTERPRETER_QUEUE_TIMEOUT = 2 * MILLISECONDS;
const INTERPRETER_TIMEOUT = INTERPRETER_WORK + INTERPRETER_QUEUE_TIMEOUT;
const RUN_THREADS = PiscinaInterpreterClient.RUN_THREADS;
const CHECK_THREADS = PiscinaInterpreterClient.CHECK_THREADS;
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

export const workflowRetry: WorkflowRetryOptions = {
  attempts: 10,
  backoff: { delay: "1s", maxDelay: "1m", jitter: "equal" },
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
  interpreter: {
    timeout: INTERPRETER_TIMEOUT,
    bulkhead: {
      maxConcurrent: RUN_THREADS,
      maxQueue: RUN_THREADS ** 2,
      queueTimeout: INTERPRETER_QUEUE_TIMEOUT,
    },
  },
  "interpreter-checks": {
    timeout: INTERPRETER_TIMEOUT,
    bulkhead: {
      maxConcurrent: CHECK_THREADS,
      maxQueue: CHECK_THREADS ** 2,
      queueTimeout: INTERPRETER_QUEUE_TIMEOUT,
    },
  },
};
