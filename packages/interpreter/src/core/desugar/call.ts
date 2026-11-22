import type * as ast from "../../syntax/index.js";
import {
  type Decoder,
  type EffectTemplate,
  type Perform,
  type Term,
  a2aDecoder,
  deadline,
  grpcDecoder,
  httpDecoder,
  mcpDecoder,
  perform,
  sentDecoder,
  termIdOf,
} from "../forms/index.js";
import type { Context } from "./context.js";
import { durationOf } from "./durations.js";
import {
  a2aTemplateOf,
  asyncApiPublishTemplateOf,
  grpcTemplateOf,
  httpTemplateOf,
  mcpTemplateOf,
  openApiTemplateOf,
} from "./effects/index.js";
import { functionCallOf } from "./function-call.js";
import { subscriptionOf } from "./subscription.js";

export function callBodyOf(
  task: ast.TaskCommon & ast.CallTask,
  context: Context,
): Term {
  const site = context.siteOf(task.pointer);
  const call = task.call;

  switch (call.kind) {
    case "http":
      return httpCallOf(site, call, context);
    case "openapi":
      return openApiCallOf(site, call, context);
    case "grpc":
      return grpcCallOf(site, call, context);
    case "asyncapi":
      return asyncApiCallOf(site, call, context);
    case "a2a":
      return a2aCallOf(site, call, context);
    case "mcp":
      return mcpCallOf(site, call, context);
    case "function":
      return functionCallOf(site, call, context);
  }
}

function httpCallOf(
  site: string,
  call: ast.HttpCall,
  context: Context,
): Perform {
  const effect = httpTemplateOf(call, context);
  const decoder = httpDecoder({ output: call.output, redirect: call.redirect });

  return performedAt(site, effect, decoder);
}

function openApiCallOf(
  site: string,
  call: ast.OpenApiCall,
  context: Context,
): Perform {
  const effect = openApiTemplateOf(call, context);
  const decoder = httpDecoder({ output: call.output, redirect: call.redirect });

  return performedAt(site, effect, decoder);
}

function grpcCallOf(
  site: string,
  call: ast.GrpcCall,
  context: Context,
): Perform {
  const effect = grpcTemplateOf(call, context);
  return performedAt(site, effect, grpcDecoder);
}

function asyncApiCallOf(
  site: string,
  call: ast.AsyncApiCall,
  context: Context,
): Term {
  const exchange = call.exchange;

  switch (exchange.kind) {
    case "message": {
      const effect = asyncApiPublishTemplateOf(call, exchange, context);
      const decoder = sentDecoder({ awaits: effect.kind });
      return performedAt(site, effect, decoder);
    }
    case "subscription":
      return subscriptionOf(call, exchange, context);
  }
}

function a2aCallOf(site: string, call: ast.A2aCall, context: Context): Perform {
  const effect = a2aTemplateOf(call, context);
  const decoder = a2aDecoder({ method: call.method });

  return performedAt(site, effect, decoder);
}

function mcpCallOf(site: string, call: ast.McpCall, context: Context): Term {
  const effect = mcpTemplateOf(call, context);
  const decoder = mcpDecoder({ method: call.method });
  const performed = performedAt(site, effect, decoder);

  return timeLimitedOf(call.timeout, performed, context);
}

function performedAt(
  site: string,
  effect: EffectTemplate,
  decoder: Decoder,
): Perform {
  const id = termIdOf(site, "perform");
  return perform({ id, effect, decoder });
}

function timeLimitedOf(
  timeout: ast.Duration | null,
  body: Perform,
  context: Context,
): Term {
  if (timeout === null) {
    return body;
  }

  const id = context.termIdOf(timeout.pointer, "timeout");
  const duration = durationOf(timeout, context);

  return deadline({ id, duration, body });
}
