export const statusPhases = [
  "pending",
  "running",
  "waiting",
  "suspended",
  "cancelled",
  "faulted",
  "completed",
] as const;
export type StatusPhase = (typeof statusPhases)[number];
