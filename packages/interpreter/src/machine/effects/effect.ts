import type {
  Effect,
  EffectId,
  EffectRequest,
  TimerRequest,
} from "../../api/index.js";
import type { EffectTemplate } from "../../core/index.js";
import type { ReceiveK, StreamWindow } from "../frames/index.js";
import { effectIdOf, executionOf } from "../identity/index.js";
import type { Owner } from "../time/index.js";
import type { RequestValues } from "../values/index.js";
import type { View } from "../view.js";
import {
  type Building,
  type Receiving,
  listenRequestOf,
  receiveRequestOf,
  requestOf,
} from "./requests/index.js";

export function effectOf(template: EffectTemplate, building: Building): Effect {
  const request = requestOf(template, building);

  return askedOf(request, building.id, building.view);
}

export function retryTimerOf(id: EffectId, until: number, view: View): Effect {
  const request: TimerRequest = { kind: "timer", until };

  return askedOf(request, id, view);
}

export function itemEffectOf(
  frame: ReceiveK,
  values: RequestValues,
  view: View,
): Effect {
  const id = effectIdOf(frame.effect);
  const building: Building = { input: frame.input, values, id, view };
  const request = itemRequestOf(frame, building);

  return askedOf(request, id, view);
}

function itemRequestOf(frame: ReceiveK, building: Building): EffectRequest {
  const source = frame.stream.source;

  switch (source.kind) {
    case "listen":
      return listenRequestOf(source, frame);
    case "subscription": {
      const receiving = receivingOf(frame);
      return receiveRequestOf(source.request, building, receiving);
    }
  }
}

function receivingOf(frame: ReceiveK): Receiving {
  const subscription = executionOf(frame.scope.path);
  const position = frame.consumption.position;
  const closesAt = closesAtOf(frame.window);

  return { subscription, position, closesAt };
}

function closesAtOf(window: StreamWindow): number | null {
  switch (window.kind) {
    case "open":
      return null;
    case "closesAt":
      return window.instant;
  }
}

function askedOf(request: EffectRequest, id: EffectId, view: View): Effect {
  const owner = view.deadline();
  const deadline = deadlineOf(owner);

  return { id, deadline, ...request };
}

function deadlineOf(owner: Owner): number | null {
  switch (owner.kind) {
    case "none":
      return null;
    case "at":
      return owner.instant;
  }
}
