import type { JsonObject } from "../../api/index.js";
import {
  type Frame,
  afterK,
  awaitK,
  beforeK,
  branchK,
  deadlineK,
  exportK,
  handleK,
  invokeK,
  joinK,
  loopK,
  receiveK,
  retryK,
  sequenceK,
  stagesK,
  streamItemK,
  streamK,
  taskK,
  taskListK,
  triggerK,
  validateK,
  workflowK,
} from "../frames/index.js";
import {
  type KindSet,
  arrayAt,
  fieldAt,
  indexAt,
  indicesAt,
  kindAt,
  numberAt,
} from "./fields.js";
import {
  awaitedAt,
  encodeAwaited,
  encodeItemKey,
  itemKeyAt,
} from "./identity-codec.js";
import type { StateReader } from "./state-reader.js";
import type { StateWriter } from "./state-writer.js";
import {
  consumptionAt,
  encodeConsumption,
  encodeItem,
  encodeWindow,
  itemAt,
  windowAt,
} from "./streams-codec.js";
import {
  attemptAt,
  completionAt,
  encodeAttempt,
  encodeCompletion,
  encodeJoined,
  encodeSignal,
  joinedAt,
  signalAt,
} from "./values-codec.js";

const frameKinds: KindSet<Frame["kind"]> = {
  sequence: true,
  taskList: true,
  task: true,
  validate: true,
  export: true,
  loop: true,
  await: true,
  handle: true,
  retry: true,
  deadline: true,
  join: true,
  branch: true,
  stream: true,
  receive: true,
  streamItem: true,
  before: true,
  stages: true,
  after: true,
  invoke: true,
  workflow: true,
  trigger: true,
};

export function encodeFrame(frame: Frame, writer: StateWriter): JsonObject {
  switch (frame.kind) {
    case "sequence": {
      const rest = writer.encodeTerms(frame.rest);
      const signal = encodeSignal(frame.signal);
      const scope = writer.encodeScope(frame.scope);
      return { kind: frame.kind, rest, signal, scope };
    }
    case "taskList": {
      const list = writer.encodeTerm(frame.list);
      const scope = writer.encodeScope(frame.scope);
      return {
        kind: frame.kind,
        list,
        index: frame.index,
        visits: frame.visits,
        scope,
      };
    }
    case "task": {
      const task = writer.encodeTerm(frame.task);
      return { kind: frame.kind, task, activation: frame.activation };
    }
    case "validate":
      return { kind: frame.kind, subject: frame.subject };
    case "export":
      return { kind: frame.kind, context: frame.context, value: frame.value };
    case "loop": {
      const loop = writer.encodeTerm(frame.loop);
      const scope = writer.encodeScope(frame.scope);
      return {
        kind: frame.kind,
        loop,
        items: frame.items,
        index: frame.index,
        scope,
      };
    }
    case "await": {
      const effect = encodeAwaited(frame.effect, writer);
      return { kind: frame.kind, effect, activation: frame.activation };
    }
    case "handle":
    case "retry": {
      const handle = writer.encodeTerm(frame.handle);
      const attempt = encodeAttempt(frame.attempt);
      const scope = writer.encodeScope(frame.scope);
      return { kind: frame.kind, handle, attempt, scope };
    }
    case "deadline":
      return { kind: frame.kind, instant: frame.instant };
    case "join": {
      const parallel = writer.encodeTerm(frame.parallel);
      const outputs = frame.outputs.map(encodeJoined);
      return {
        kind: frame.kind,
        parallel,
        branches: frame.branches,
        outputs,
      };
    }
    case "branch":
      return { kind: frame.kind, index: frame.index };
    case "stream": {
      const stream = writer.encodeTerm(frame.stream);
      const consumption = encodeConsumption(frame.consumption);
      const window = encodeWindow(frame.window);
      const scope = writer.encodeScope(frame.scope);
      return {
        kind: frame.kind,
        stream,
        consumption,
        window,
        input: frame.input,
        scope,
      };
    }
    case "receive": {
      const stream = writer.encodeTerm(frame.stream);
      const consumption = encodeConsumption(frame.consumption);
      const window = encodeWindow(frame.window);
      const effect = encodeItemKey(frame.effect, writer);
      const scope = writer.encodeScope(frame.scope);
      return {
        kind: frame.kind,
        stream,
        consumption,
        window,
        input: frame.input,
        effect,
        scope,
      };
    }
    case "streamItem": {
      const stream = writer.encodeTerm(frame.stream);
      const item = encodeItem(frame.item);
      const scope = writer.encodeScope(frame.scope);
      return {
        kind: frame.kind,
        stream,
        iterator: frame.iterator,
        item,
        scope,
      };
    }
    case "before": {
      const extend = writer.encodeTerm(frame.extend);
      const scope = writer.encodeScope(frame.scope);
      return {
        kind: frame.kind,
        extend,
        applying: frame.applying,
        at: frame.at,
        value: frame.value,
        scope,
      };
    }
    case "stages": {
      const extend = writer.encodeTerm(frame.extend);
      const scope = writer.encodeScope(frame.scope);
      return { kind: frame.kind, extend, applying: frame.applying, scope };
    }
    case "after": {
      const extend = writer.encodeTerm(frame.extend);
      const completion = encodeCompletion(frame.completion);
      const scope = writer.encodeScope(frame.scope);
      return {
        kind: frame.kind,
        extend,
        applying: frame.applying,
        at: frame.at,
        completion,
        scope,
      };
    }
    case "invoke":
      return { kind: frame.kind };
    case "workflow":
    case "trigger":
      return { kind: frame.kind, activation: frame.activation };
  }
}

export function decodeFrame(encoded: JsonObject, reader: StateReader): Frame {
  const kind = kindAt(encoded, frameKinds);

  switch (kind) {
    case "sequence": {
      const rest = reader.termsAt(encoded, "rest");
      const signal = signalAt(encoded, "signal");
      const scope = reader.scopeAt(encoded, "scope");
      return sequenceK({ rest, signal, scope });
    }
    case "taskList": {
      const list = reader.formAt(encoded, "list", "taskList");
      const index = indexAt(encoded, "index");
      const visits = indicesAt(encoded, "visits");
      const scope = reader.scopeAt(encoded, "scope");
      return taskListK({ list, index, visits, scope });
    }
    case "task": {
      const task = reader.formAt(encoded, "task", "task");
      const activation = indexAt(encoded, "activation");
      return taskK({ task, activation });
    }
    case "validate": {
      const subject = fieldAt(encoded, "subject");
      return validateK({ subject });
    }
    case "export": {
      const context = fieldAt(encoded, "context");
      const value = fieldAt(encoded, "value");
      return exportK({ context, value });
    }
    case "loop": {
      const loop = reader.formAt(encoded, "loop", "loop");
      const items = arrayAt(encoded, "items");
      const index = indexAt(encoded, "index");
      const scope = reader.scopeAt(encoded, "scope");
      return loopK({ loop, items, index, scope });
    }
    case "await": {
      const effect = awaitedAt(encoded, "effect", reader);
      const activation = indexAt(encoded, "activation");
      return awaitK({ effect, activation });
    }
    case "handle": {
      const handle = reader.formAt(encoded, "handle", "handle");
      const attempt = attemptAt(encoded, "attempt");
      const scope = reader.scopeAt(encoded, "scope");
      return handleK({ handle, attempt, scope });
    }
    case "retry": {
      const handle = reader.formAt(encoded, "handle", "handle");
      const attempt = attemptAt(encoded, "attempt");
      const scope = reader.scopeAt(encoded, "scope");
      return retryK({ handle, attempt, scope });
    }
    case "deadline": {
      const instant = numberAt(encoded, "instant");
      return deadlineK({ instant });
    }
    case "join": {
      const parallel = reader.formAt(encoded, "parallel", "parallel");
      const branches = indicesAt(encoded, "branches");
      const outputs = joinedAt(encoded, "outputs");
      return joinK({ parallel, branches, outputs });
    }
    case "branch": {
      const index = indexAt(encoded, "index");
      return branchK({ index });
    }
    case "stream": {
      const stream = reader.formAt(encoded, "stream", "stream");
      const consumption = consumptionAt(encoded, "consumption");
      const window = windowAt(encoded, "window");
      const input = fieldAt(encoded, "input");
      const scope = reader.scopeAt(encoded, "scope");
      return streamK({ stream, consumption, window, input, scope });
    }
    case "receive": {
      const stream = reader.formAt(encoded, "stream", "stream");
      const consumption = consumptionAt(encoded, "consumption");
      const window = windowAt(encoded, "window");
      const input = fieldAt(encoded, "input");
      const effect = itemKeyAt(encoded, "effect", reader);
      const scope = reader.scopeAt(encoded, "scope");
      return receiveK({ stream, consumption, window, input, effect, scope });
    }
    case "streamItem": {
      const stream = reader.formAt(encoded, "stream", "stream");
      const iterator = indexAt(encoded, "iterator");
      const item = itemAt(encoded, "item");
      const scope = reader.scopeAt(encoded, "scope");
      return streamItemK({ stream, iterator, item, scope });
    }
    case "before": {
      const extend = reader.formAt(encoded, "extend", "extend");
      const applying = indicesAt(encoded, "applying");
      const at = indexAt(encoded, "at");
      const value = fieldAt(encoded, "value");
      const scope = reader.scopeAt(encoded, "scope");
      return beforeK({ extend, applying, at, value, scope });
    }
    case "stages": {
      const extend = reader.formAt(encoded, "extend", "extend");
      const applying = indicesAt(encoded, "applying");
      const scope = reader.scopeAt(encoded, "scope");
      return stagesK({ extend, applying, scope });
    }
    case "after": {
      const extend = reader.formAt(encoded, "extend", "extend");
      const applying = indicesAt(encoded, "applying");
      const at = indexAt(encoded, "at");
      const completion = completionAt(encoded, "completion");
      const scope = reader.scopeAt(encoded, "scope");
      return afterK({ extend, applying, at, completion, scope });
    }
    case "invoke":
      return invokeK;
    case "workflow": {
      const activation = indexAt(encoded, "activation");
      return workflowK({ activation });
    }
    case "trigger": {
      const activation = indexAt(encoded, "activation");
      return triggerK({ activation });
    }
  }
}
