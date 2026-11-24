import type { Decoder } from "../../core/index.js";
import type { StatusPhase } from "../../standard/index.js";
import type { Awaited, AwaitK, ReceiveK } from "../frames/index.js";
import { type Address, withPhase } from "../registers/index.js";
import { type Write, reported, updated } from "../transitions/index.js";
import type { View } from "../view.js";
import { workflowStartedOf } from "./events.js";

export type AwaitedPhase = Extract<StatusPhase, "running" | "waiting">;

export function workflowBegunOf(
  address: Address,
  view: View,
): readonly Write[] {
  const event = workflowStartedOf(view);
  const started = reported(event);
  const running = phaseChangedOf(address, "running", view);

  return [started, ...running];
}

export function phaseChangedOf(
  address: Address,
  phase: StatusPhase,
  view: View,
): readonly Write[] {
  const cell = view.store.cellAt(address);
  const moved = withPhase(cell, phase);
  const update = updated(address, moved);

  return [update];
}

export function awaitedPhaseOf(frame: AwaitK | ReceiveK): AwaitedPhase {
  switch (frame.kind) {
    case "await":
      return effectPhaseOf(frame.effect);
    case "receive":
      return "waiting";
  }
}

function effectPhaseOf(effect: Awaited): AwaitedPhase {
  switch (effect.kind) {
    case "perform":
      return decoderPhaseOf(effect.perform.decoder);
    case "schema":
      return "running";
    case "retry":
      return "waiting";
  }
}

function decoderPhaseOf(decoder: Decoder): AwaitedPhase {
  switch (decoder.kind) {
    case "input":
      return decoder.awaits === "timer" ? "waiting" : "running";
    case "sent":
    case "http":
    case "grpc":
    case "a2a":
    case "mcp":
    case "process":
    case "workflow":
      return "running";
  }
}
