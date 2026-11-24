import type { TaskKind } from "interpreter/front-end";
import type { StepFamily } from "./interfaces.js";

export const stepFamilies: Readonly<Record<TaskKind, StepFamily>> = {
  do: "flow",
  for: "flow",
  fork: "flow",
  switch: "flow",
  try: "flow",
  call: "call",
  run: "call",
  set: "data",
  emit: "event",
  listen: "event",
  wait: "time",
  raise: "error",
};
