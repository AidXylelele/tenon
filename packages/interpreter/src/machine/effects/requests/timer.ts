import type { TimerRequest } from "../../../api/index.js";
import type { TimerTemplate } from "../../../core/index.js";
import { requestInstantOf } from "../../values/index.js";
import type { Building } from "./building.js";

export function timerRequestOf(
  timer: TimerTemplate,
  building: Building,
): TimerRequest {
  const until = requestInstantOf(
    timer.duration,
    building.values,
    building.view,
  );
  return { kind: "timer", until };
}
