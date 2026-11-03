export enum WorkflowStatus {
  Active = 'active',
  Archived = 'archived',
}

// Why a workflow refuses a request; the presentation turns the code into a message.
export enum WorkflowRefusal {
  Archived = 'workflow.archived',
  VersionTaken = 'workflow.version-taken',
  Off = 'workflow.off',
}

// What a saved workflow tells the platform: its schedule starts instances from now on in
// another way, or no longer (FR-006, US4 AS4).
export enum WorkflowEventKind {
  ScheduleChanged = 'workflow.schedule-changed',
}
