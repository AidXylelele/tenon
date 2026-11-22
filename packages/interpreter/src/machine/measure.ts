import { type StepMeasure, secondsBetween } from "../telemetry/index.js";
import type { MachineOutcome } from "./machine.js";

export function measureOf(outcome: MachineOutcome, now: number): StepMeasure {
  const snapshot = outcome.snapshot;
  const run = snapshot.run;
  const lifetime = lifetimeOf(outcome, now);

  return {
    instance: run.instance,
    status: snapshot.status,
    transitions: outcome.transitions,
    fibers: snapshot.fibers.length,
    requested: outcome.requested.length,
    events: outcome.events.length,
    lifetime,
  };
}

function lifetimeOf(outcome: MachineOutcome, now: number): number | null {
  const snapshot = outcome.snapshot;
  const hasEnded = snapshot.result.kind !== "running";

  if (!hasEnded) {
    return null;
  }

  return secondsBetween(snapshot.run.startedAt, now);
}
