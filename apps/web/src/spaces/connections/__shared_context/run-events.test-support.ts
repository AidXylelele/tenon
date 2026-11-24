import type { RunEvent } from "./notifications";

export const RUN_EVENTS: readonly RunEvent[] = [
  {
    label: "A run fails",
    value: "org.open-workflow-specification.workflow.faulted.v1",
  },
  {
    label: "A run succeeds",
    value: "org.open-workflow-specification.workflow.completed.v1",
  },
  {
    label: "A run starts",
    value: "org.open-workflow-specification.workflow.started.v1",
  },
];
