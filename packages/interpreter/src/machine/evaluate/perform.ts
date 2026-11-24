import type {
  AsyncApiRequest,
  EffectRequest,
  JsonValue,
} from "../../api/index.js";
import type { Decoder, Perform } from "../../core/index.js";
import { InterpreterError } from "../../runtime/index.js";
import { type Building, effectOf } from "../effects/index.js";
import { type AwaitK, awaitK, performAnswerOf } from "../frames/index.js";
import { effectIdOf, performKeyOf } from "../identity/index.js";
import { awaitedPhaseOf, phaseChangedOf } from "../lifecycle/index.js";
import type { Here } from "../registers/index.js";
import {
  type Transition,
  type Write,
  requested,
  suspending,
  transitionOf,
} from "../transitions/index.js";
import { heldValuesOf } from "../values/index.js";
import type { View } from "../view.js";

export function evaluatePerform(
  term: Perform,
  here: Here,
  view: View,
): Transition {
  const values = heldValuesOf(term.effect, here, view);
  const key = performKeyOf(here.scope.path);
  const id = effectIdOf(key);
  const building: Building = { input: here.value, values, id, view };
  const effect = effectOf(term.effect, building);
  const asked = requested(effect);
  const carried = carriedOf(term.decoder, effect, here.value);
  const answer = performAnswerOf(key, term, carried);
  const frame = awaitK({ effect: answer, activation: here.scope.activation });
  const waiting = waitingOf(frame, view);
  const frames = [frame];
  const writes = [asked, ...waiting];

  return transitionOf(suspending, frames, writes);
}

function waitingOf(frame: AwaitK, view: View): readonly Write[] {
  const awaited = awaitedPhaseOf(frame);

  switch (awaited) {
    case "running":
      return [];
    case "waiting":
      return phaseChangedOf(frame.activation, awaited, view);
  }
}

function carriedOf(
  decoder: Decoder,
  request: EffectRequest,
  input: JsonValue,
): JsonValue {
  switch (decoder.kind) {
    case "input":
      return input;
    case "sent":
      return sentOf(request);
    case "http":
    case "grpc":
    case "a2a":
    case "mcp":
    case "process":
    case "workflow":
      return null;
  }
}

function sentOf(request: EffectRequest): JsonValue {
  switch (request.kind) {
    case "emit":
      return request.event;
    case "asyncapi":
      return publishedOf(request);
    case "http":
    case "openapi":
    case "grpc":
    case "a2a":
    case "mcp":
    case "process":
    case "workflow":
    case "timer":
    case "listen":
    case "resource":
      throw new InterpreterError(`The ${request.kind} request sends nothing.`);
  }
}

function publishedOf(request: AsyncApiRequest): JsonValue {
  const exchange = request.exchange;

  switch (exchange.kind) {
    case "publish":
      return {
        payload: exchange.message.payload,
        headers: exchange.message.headers,
      };
    case "receive":
      throw new InterpreterError("An AsyncAPI receive publishes nothing.");
  }
}
