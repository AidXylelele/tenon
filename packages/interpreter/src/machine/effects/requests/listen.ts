import type { ListenRequest } from "../../../api/index.js";
import type { ListenSource } from "../../../core/index.js";
import type { ReceiveK } from "../../frames/index.js";
import { executionOf } from "../../identity/index.js";
import { openFiltersOf } from "../../streams/index.js";

export function listenRequestOf(
  listen: ListenSource,
  frame: ReceiveK,
): ListenRequest {
  const subscription = executionOf(frame.scope.path);
  const consumption = frame.consumption;
  const open = openFiltersOf(listen.strategy, consumption);

  return {
    kind: "listen",
    stream: frame.stream.id,
    subscription,
    position: consumption.position,
    open,
  };
}
