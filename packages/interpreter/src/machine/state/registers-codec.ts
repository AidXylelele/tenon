import type { JsonObject } from "../../api/index.js";
import { statusPhases } from "../../standard/index.js";
import {
  type Activation,
  type Address,
  type RunRecord,
  Store,
  activationOf,
  runRecordOf,
  withAuthorization,
  withInput,
  withOutput,
  withPhase,
} from "../registers/index.js";
import {
  fieldAt,
  indexAt,
  memberAt,
  numberAt,
  objectAt,
  objectsAt,
  stringAt,
} from "./fields.js";
import type { StateReader } from "./state-reader.js";
import type { StateWriter } from "./state-writer.js";

type Cell = readonly [Address, Activation];

export function encodeRun(run: RunRecord): JsonObject {
  return { instance: run.instance, input: run.input, startedAt: run.startedAt };
}

export function decodeRun(encoded: JsonObject): RunRecord {
  const instance = stringAt(encoded, "instance");
  const input = fieldAt(encoded, "input");
  const startedAt = numberAt(encoded, "startedAt");

  return runRecordOf(instance, input, startedAt);
}

export function encodeStore(store: Store, writer: StateWriter): JsonObject {
  const held = [...store.cells()];
  const byAddress = held.toSorted((one, other) => one[0] - other[0]);
  const cells = byAddress.map((cell) => encodeCell(cell, writer));

  return { context: store.context, next: store.next, cells };
}

function encodeCell(cell: Cell, writer: StateWriter): JsonObject {
  const activation = encodeActivation(cell[1], writer);

  return { address: cell[0], activation };
}

function encodeActivation(
  activation: Activation,
  writer: StateWriter,
): JsonObject {
  const descriptor = writer.encodeDescriptor(activation.descriptor);
  const path = writer.encodePath(activation.path);

  return {
    descriptor,
    enclosing: activation.enclosing,
    path,
    startedAt: activation.startedAt,
    input: activation.input,
    output: activation.output,
    authorization: activation.authorization,
    phase: activation.phase,
  };
}

export function decodeStore(encoded: JsonObject, reader: StateReader): Store {
  const context = fieldAt(encoded, "context");
  const next = indexAt(encoded, "next");
  const saved = objectsAt(encoded, "cells");
  const cells = saved.map((cell) => decodeCell(cell, reader));

  return Store.restored({ context, next, cells });
}

function decodeCell(encoded: JsonObject, reader: StateReader): Cell {
  const address = indexAt(encoded, "address");
  const activation = activationAt(encoded, "activation", reader);

  return [address, activation];
}

function activationAt(
  encoded: JsonObject,
  key: string,
  reader: StateReader,
): Activation {
  const cell = objectAt(encoded, key);
  const descriptor = reader.descriptorAt(cell, "descriptor");
  const enclosing = indexAt(cell, "enclosing");
  const path = reader.pathAt(cell, "path");
  const startedAt = numberAt(cell, "startedAt");
  const input = fieldAt(cell, "input");
  const output = fieldAt(cell, "output");
  const authorization = fieldAt(cell, "authorization");
  const phase = memberAt(cell, "phase", statusPhases);

  const entered = activationOf({ descriptor, enclosing, path, startedAt });
  const read = withInput(entered, input);
  const written = withOutput(read, output);
  const authorized = withAuthorization(written, authorization);
  return withPhase(authorized, phase);
}
