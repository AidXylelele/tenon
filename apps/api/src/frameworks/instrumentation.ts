import { isMainThread } from "node:worker_threads";

const telemetry = isMainThread
  ? await import("./opentelemetry/process.sdk.js")
  : await import("./opentelemetry/thread.sdk.js");

export const sdk = telemetry.sdk;
