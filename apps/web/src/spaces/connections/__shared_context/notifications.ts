import type { EventFilter, HostProfile } from "@/libs/data-access/types";
import { describeFilter } from "./event-filter";

export const NOTIFICATIONS_PURPOSE =
  "Notifications deliver events to other apps.";

export interface RunEvent {
  readonly label: string;
  readonly value: string;
}

const RUN_EVENTS = [
  { label: "A run fails", event: "workflow.faulted" },
  { label: "A run succeeds", event: "workflow.completed" },
  { label: "A run starts", event: "workflow.started" },
];

export function runEventsOf(profile: HostProfile): readonly RunEvent[] {
  return RUN_EVENTS.flatMap((known): RunEvent[] => {
    const event = profile.lifecycleEvents.find(
      (each) => each.name === known.event,
    );
    const type = event?.types.at(0);
    return type === undefined ? [] : [{ label: known.label, value: type }];
  });
}

export function whenOf(
  filter: EventFilter,
  runEvents: readonly RunEvent[],
): string {
  const type = filter.with["type"];
  const others = Object.keys(filter.with).filter((key) => key !== "type");
  const known = runEvents.find((each) => each.value === type);

  if (known !== undefined && others.length === 0) return known.label;

  return `An event where ${describeFilter(filter)}`;
}
