import { Stack } from "immutable";
import type {
  EffectOutcome,
  EffectResponse,
  JsonObject,
  State,
  Step,
} from "../../api/index.js";
import { stateFormatVersion } from "../../core/index.js";
import { InterpreterError, type JsonOf } from "../../runtime/index.js";
import { statusPhases } from "../../standard/index.js";
import { type Fiber, fiberOf } from "../fibers/index.js";
import { type FiberId, repeatedOf } from "../registers/index.js";
import {
  cancelledRun,
  completedWith,
  faultedWith,
} from "../transitions/index.js";
import {
  checkTextAt,
  fieldAt,
  indexAt,
  memberAt,
  objectAt,
  objectsAt,
  stringAt,
} from "./fields.js";
import { decodeFrame, encodeFrame } from "./frames-codec.js";
import {
  decodeRun,
  decodeStore,
  encodeRun,
  encodeStore,
} from "./registers-codec.js";
import { type Seal, type Snapshot, snapshotOf, unended } from "./snapshot.js";
import { StateReader } from "./state-reader.js";
import { StateWriter } from "./state-writer.js";

interface Layout {
  readonly run: JsonObject;
  readonly status: Step["status"];
  readonly result: Snapshot["result"];
  readonly store: JsonObject;
  readonly environments: readonly JsonObject[];
  readonly paths: readonly JsonObject[];
  readonly fibers: readonly JsonObject[];
  readonly nextFiber: number;
  readonly queued: readonly JsonObject[];
}

export function encodeState(snapshot: Snapshot, seal: Seal): State {
  const writer = new StateWriter(seal.terms);
  const fibers = snapshot.fibers.map((fiber) => encodeFiber(fiber, writer));
  const store = encodeStore(snapshot.store, writer);
  const environments = writer.environments;
  const paths = writer.paths;
  const run = encodeRun(snapshot.run);
  const result = encodeResult(snapshot.result);
  const queued = snapshot.queued.map(encodeResponse);

  const encoded: JsonObject = {
    format: stateFormatVersion,
    fingerprint: seal.fingerprint,
    run,
    status: snapshot.status,
    result,
    store,
    environments,
    paths,
    fibers,
    nextFiber: snapshot.nextFiber,
    queued,
  };

  return encoded as State;
}

function encodeFiber(fiber: Fiber, writer: StateWriter): JsonObject {
  const topFirst = fiber.continuation.toArray();
  const bottomFirst = topFirst.toReversed();
  const continuation = bottomFirst.map((frame) => encodeFrame(frame, writer));

  return { id: fiber.id, parent: fiber.parent, continuation };
}

function encodeResult(result: Snapshot["result"]): JsonObject {
  switch (result.kind) {
    case "running":
    case "cancelled":
      return { kind: result.kind };
    case "completed":
      return { kind: result.kind, output: result.output };
    case "faulted":
      return { kind: result.kind, error: result.error };
  }
}

function encodeResponse(response: EffectResponse): JsonObject {
  const outcome: JsonOf<EffectOutcome> = response.outcome;
  return { id: response.id, outcome };
}

export function decodeState(state: JsonObject, seal: Seal): Snapshot {
  checkFormat(state);
  checkFingerprint(state, seal.fingerprint);

  const layout = layoutOf(state);
  const reader = new StateReader(seal.terms, layout.environments, layout.paths);
  const run = decodeRun(layout.run);
  const store = decodeStore(layout.store, reader);
  const fibers = layout.fibers.map((fiber) => decodeFiber(fiber, reader));
  const queued = layout.queued.map(decodeResponse);

  checkFibers(fibers, layout.nextFiber);
  return snapshotOf({
    run,
    status: layout.status,
    store,
    fibers,
    nextFiber: layout.nextFiber,
    queued,
    result: layout.result,
  });
}

function checkFormat(state: JsonObject): void {
  const format = fieldAt(state, "format");

  if (format !== stateFormatVersion) {
    const written = JSON.stringify(format);
    throw new InterpreterError(
      `The state is of format ${written}; this interpreter reads format ${String(stateFormatVersion)}.`,
    );
  }
}

function checkFingerprint(state: JsonObject, fingerprint: string): void {
  const saved = stringAt(state, "fingerprint");

  if (saved !== fingerprint) {
    throw new InterpreterError(
      `The state was saved under the fingerprint ${saved}; this program's fingerprint is ${fingerprint}.`,
    );
  }
}

function layoutOf(state: JsonObject): Layout {
  const run = objectAt(state, "run");
  const status = statusAt(state, "status");
  const result = resultAt(state, "result");
  const store = objectAt(state, "store");
  const environments = objectsAt(state, "environments");
  const paths = objectsAt(state, "paths");
  const fibers = objectsAt(state, "fibers");
  const nextFiber = indexAt(state, "nextFiber");
  const queued = objectsAt(state, "queued");

  checkResult(status, result);
  return {
    run,
    status,
    result,
    store,
    environments,
    paths,
    fibers,
    nextFiber,
    queued,
  };
}

function statusAt(state: JsonObject, key: string): Step["status"] {
  const phase = memberAt(state, key, statusPhases);

  switch (phase) {
    case "running":
    case "suspended":
    case "completed":
    case "faulted":
    case "cancelled":
      return phase;
    case "pending":
    case "waiting":
      throw new InterpreterError(`A run is never '${phase}' between steps.`);
  }
}

function resultAt(state: JsonObject, key: string): Snapshot["result"] {
  const encoded = objectAt(state, key);
  const kind = memberAt(encoded, "kind", statusPhases);

  switch (kind) {
    case "running":
      return unended;
    case "cancelled":
      return cancelledRun;
    case "completed": {
      const output = fieldAt(encoded, "output");
      return completedWith(output);
    }
    case "faulted": {
      const error = objectAt(encoded, "error");
      return faultedWith(error);
    }
    case "pending":
    case "waiting":
    case "suspended":
      throw new InterpreterError(`A run never ends '${kind}'.`);
  }
}

function checkResult(status: Step["status"], result: Snapshot["result"]): void {
  const resultKind = resultKindOf(status);

  if (result.kind !== resultKind) {
    throw new InterpreterError(
      `The state's status '${status}' disagrees with its result '${result.kind}'.`,
    );
  }
}

function resultKindOf(status: Step["status"]): Snapshot["result"]["kind"] {
  switch (status) {
    case "running":
    case "suspended":
      return "running";
    case "completed":
    case "faulted":
    case "cancelled":
      return status;
  }
}

function decodeFiber(encoded: JsonObject, reader: StateReader): Fiber {
  const id = indexAt(encoded, "id");
  const parent = parentAt(encoded, "parent");
  const bottomFirst = objectsAt(encoded, "continuation");
  const frames = bottomFirst.map((frame) => decodeFrame(frame, reader));
  const topFirst = frames.toReversed();
  const continuation = Stack(topFirst);

  return fiberOf(id, parent, continuation);
}

function parentAt(encoded: JsonObject, key: string): FiberId | "root" {
  const parent = fieldAt(encoded, key);

  if (parent === "root") {
    return parent;
  }

  return indexAt(encoded, key);
}

function decodeResponse(encoded: JsonObject): EffectResponse {
  const id = stringAt(encoded, "id");
  const outcome = outcomeAt(encoded, "outcome");

  return { id, outcome };
}

function outcomeAt(encoded: JsonObject, key: string): EffectOutcome {
  const outcome = objectAt(encoded, key);

  checkTextAt(outcome, "kind");
  return outcome as JsonOf<EffectOutcome>;
}

function checkFibers(fibers: readonly Fiber[], nextFiber: FiberId): void {
  const ids = fibers.map((fiber) => fiber.id);
  const beyond = ids.find((id) => id >= nextFiber);
  const repeated = repeatedOf(ids);

  if (beyond !== undefined) {
    throw new InterpreterError(
      `The state holds the fiber ${String(beyond)}, not below its next fiber ${String(nextFiber)}.`,
    );
  }

  if (repeated !== undefined) {
    throw new InterpreterError(
      `The state holds two fibers numbered ${String(repeated)}.`,
    );
  }
}
